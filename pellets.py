import sqlite3
import json
import requests
import datetime
import pytz
from dateutil.parser import parse
import time
import sched
import argparse

parser = argparse.ArgumentParser(description='Log data from an ARITERM Biomatic 20i to a sqlite database')
parser.add_argument("ip", help="The IP of the boiler eg. 192.168.2.246")
parser.add_argument("user", help="The login username, eg logger@BM20Pxxxxxx")
parser.add_argument("passwd", help="The login password. Use '' around it if it contains special characters")
parser.add_argument("-db", "--database", metavar="DB", default="pellets.db",  help="The sqlite database file (default: %(default)s)")
parser.add_argument("--request_interval", metavar="INTERVAL", default=10, type=int, help="The interval of requests in seconds sent to the boilder (default: %(default)i")
parser.add_argument("--db_storage_interval", metavar="INTERVAL", default=180, type=int, help="The interval in seconds when to store to database (default: %(default)i")
parser.add_argument("--skip_store_on_stats_change", action='store_true', help="Skip store to database on status change, i.e only store on regular interval")
parser.add_argument("--create_db", help="Initial creation of database. ip, user and passwd will be ignored", action='store_true')

args = parser.parse_args()

storage_interval = args.db_storage_interval
request_interval = args.request_interval
store_on_status_change = args.skip_store_on_stats_change == False
url = "http://" + args.ip
username = args.user
password = args.passwd
database_name = args.database

def DropTable(conn):
    c=conn.cursor()
    c.execute("DROP TABLE pellets")
    conn.commit()
    conn.close()

def IsResponseStatusOK(response):
    return response.status_code == 200

def TryLogin(cnt):
    if cnt > 5:
        raise Exception("Too many failed logins")
    login_response = requests.post( url+'/login', params={'username':username,'password':password,'remember_me':'on'})
    if IsResponseStatusOK(login_response):
        print( "+++ Login OK")
        return login_response
    cnt += 1
    time.sleep(cnt * 10)
    print( "--- Retry login cnt: ", cnt)
    return TryLogin(cnt)

def TryRequestDashboard(login, cnt = 0):
    if cnt > 5:
        raise Exception("Too many failed dashboard requests")
    if login == None or IsResponseStatusOK(login) == False:
        login = TryLogin(0)
    dash_response = requests.get(url +'/api/dashboard', cookies=login.cookies)
    if IsResponseStatusOK(dash_response):
        print("+++ Dashboard OK")
        return (dash_response, login)
    cnt += 1
    print( "--- Retry Dashboard cnt: ", cnt)
    time.sleep(cnt * 10)
    login = TryLogin(0)
    return TryRequestDashboard(login, cnt)

def ConnectToDatabase(name):
    return sqlite3.connect(name)

def GetLastTimestamp(r_json):
    timestamp = parse(max(map(lambda x: x['timeStamp'] , r_json['readings'])))
    return timestamp
    #return pytz.timezone("Europe/Stockholm").localize(timestamp).isoformat()

def CreateDatabase(conn):
    c=conn.cursor()
    c.execute('''CREATE TABLE pellets(
        id int, 
        date text, status text, onOff bool, boilerTemp float, 
        indoorTemp float, outdoorTemp float, pelletsLevel float, gasTemp float,
        pelletsAlerts bool, alerts bool, coldStarts int, warmStarts int,
        syncStatus bool, maintenance1 int, maintenance2 int, supplyTemp float
    )''')
    conn.commit()

def CloseDatabase(conn):
    conn.close()

def GetMaxId(conn):
    id = conn.execute('SELECT MAX(id) FROM pellets').fetchone()
    if(id[0] == None):
        return 0
    return id[0]

def GetReadingsValue(r_json, identifier):
    return [x for x in r_json['readings'] if x['component_key'] == identifier][0]['value']

def GetBoilerStatus(r_json):
    return r_json['state']['state_key']

def GetOnOff(r_json):
    return r_json['settings']['onOff']['value'] > 0.5

def GetIndoorTemp(r_json):
    return GetReadingsValue(r_json, "IndoorTemperatureValue")

def GetOutdoorTemp(r_json):
    return GetReadingsValue(r_json, "OutdoorTemperatureValue")

def GetBoilerTemp(r_json):
    return GetReadingsValue(r_json, "BoilerTemperatureValue")

def GetGasTemp(r_json):
    return GetReadingsValue(r_json, "FlueGasTemp")

def GetPelletsLevel(r_json):
    return GetReadingsValue(r_json, "PelletLevelValue")

def GetColdStarts(r_json):
    return GetReadingsValue(r_json, "NumOfColdStarts")

def GetWarmStarts(r_json):
    return GetReadingsValue(r_json, "NumOfWarmStarts")

def GetMaintenance1Counter(r_json):
    return GetReadingsValue(r_json, "Maintenance1Counter")

def GetMaintenance2Counter(r_json):
    return GetReadingsValue(r_json, "Maintenance2Counter")

def GetSupplyTemp(r_json):
    return GetReadingsValue(r_json, "SupplyTemperatureValue")

def GetPelletsAlarms(r_json):
    return r_json["pellets_alarms"]

def GetAlarms(r_json):
    return r_json["alarms"]

def GetSyncStatus(r_json):
    return r_json["syncStatus"]

def CreateValues(r_json, id):
    return (id,
        GetLastTimestamp(r_json), 
        GetBoilerStatus(r_json),
        GetOnOff(r_json),
        GetBoilerTemp(r_json),
        GetIndoorTemp(r_json),
        GetOutdoorTemp(r_json),
        GetPelletsLevel(r_json),
        GetGasTemp(r_json),
        GetPelletsAlarms(r_json),
        GetAlarms(r_json),
        GetColdStarts(r_json),
        GetWarmStarts(r_json),
        GetSyncStatus(r_json),
        GetMaintenance1Counter(r_json),
        GetMaintenance2Counter(r_json),
        GetSupplyTemp(r_json)
    )

def AppendValuesToDatabase(conn, response):
    conn.execute("INSERT INTO pellets VALUES (?, ?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?)", 
    CreateValues(response.json(), GetMaxId(conn)+1))
    conn.commit()

def ModifyLastRowInDatabase(conn, response):
    value_list = CreateValues(response.json(), GetMaxId(conn))
    conn.execute("DELETE FROM pellets WHERE id = ?", value_list[0:1])
    conn.execute("INSERT INTO pellets VALUES (?, ?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?)", value_list)
    conn.commit()

def ShallModifyInsteadOfAppend(conn):
    lst = conn.execute("SELECT date, status FROM pellets ORDER BY id DESC LIMIT 2").fetchall()
    if len(lst) < 2:
        return False
    time0 = parse(lst[0][0])
    time1 = parse(lst[1][0])

    status0 = lst[0][1]
    status1 = lst[1][1]

    if store_on_status_change and status0 != status1:
        return False
    shallModifyDueToTime = (time0-time1).total_seconds() < storage_interval
    return shallModifyDueToTime

def SetResponseToDB(conn, response):
    if IsResponseStatusOK(response) != True:
        return
    if ShallModifyInsteadOfAppend(conn):
        ModifyLastRowInDatabase(conn, response)
    else:
        AppendValuesToDatabase(conn, response)
    print( "Value -> DB", conn.execute('SELECT * FROM pellets ORDER BY id DESC LIMIT 1').fetchone())


import sys
def DoPolling(login_response, conn, scheduler):
    try:
        (dash, login_response) = TryRequestDashboard(login_response, 0)
        SetResponseToDB(conn, dash)
        scheduler.enter(request_interval, 1, DoPolling,(login_response, conn, scheduler))
    except:
        for ev in scheduler.queue:
            scheduler.cancel(ev)
        conn.close()
        print( "Exception caught: ", sys.exc_info()[0])
        raise

def main():
    db = ConnectToDatabase(database_name)
    if args.create_db:
        CreateDatabase(db)
    else:
        scheduler = sched.scheduler(time.time, time.sleep)
        scheduler.enter(1, 1, DoPolling, (None, db, scheduler))
        scheduler.run()

if __name__ == "__main__":
    # execute only if run as a script
    main()
