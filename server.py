import sys
from twisted.web.server import Site, Request
from twisted.web.resource import Resource
from twisted.web.static import File
from twisted.internet import reactor, endpoints
from twisted.python import log
from dateutil.parser import parse
import sqlite3
import datetime as dt
import json
import pytz
import argparse

parser = argparse.ArgumentParser(description='Log data from an ARITERM Biomatic 20i to a sqlite database')
parser.add_argument("-db", "--database", default="pellets.db",  help="The sqlite database file (default: %(default)s)")
parser.add_argument("-p", "--port", default=8080,  type=int, help="Webserver port (default: %(default)i)")
parser.add_argument("-v", "--verbose", action='store_true',  help="verbose logging of calls")

args = parser.parse_args()

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

tz = pytz.timezone('Europe/Stockholm')

def convertToDBLocal(t):
    if t == None:
        return t
    theTime = t
    if t.tzinfo != None:
        theTime = t.astimezone(tz)    
    ret = theTime.strftime("%Y-%m-%d %H:%M:%S")
    return ret

def convertToIsoformatWithTz(t):
    ret = tz.localize(parse(t)).isoformat()
    return ret

class DataFetching(Resource):
    isLeaf = True

    def __init__(self, databaseName):
        print("Open database " + databaseName)
        self.db = sqlite3.connect(databaseName)
        self.db.row_factory = dict_factory

    def __del__(self):
        self.db.close()

    def getLast(self):
        ret = self.db.execute("SELECT * FROM pellets WHERE ID IN (SELECT MAX(ID) from pellets)").fetchone()
        now = dt.datetime.now()
        start = now - dt.timedelta(1)
        usage = self.computeUsage(start, now)
        ret['usage'] = usage
        ret['date'] = convertToIsoformatWithTz(ret['date'])
        #append timecode
        return json.dumps(ret).encode("utf8")

    def computeUsage(self, start, end):
        q = "SELECT date, pelletsLevel FROM pellets WHERE date>= '{0}' AND DATE <= '{1}' ORDER BY ID".format(convertToDBLocal(start),  convertToDBLocal(end))
        levels = self.db.execute(q).fetchall()
        if len(levels) < 2:
            return 0.0

        if levels[0] == None or levels[0]['date'] == None or levels[-1] == None or levels[-1]['date'] == None:
            return 0.0

        lastVal = levels[0]['pelletsLevel']
        usage = 0.0
        for val in levels:
            currVal = val['pelletsLevel']
            if currVal < lastVal:
                usage += lastVal - currVal
            lastVal = currVal

        startDate = parse(levels[0]['date'])
        endDate = parse(levels[-1]['date'])
        timespan = endDate - startDate
        dayFactor = timespan.total_seconds() / dt.timedelta(1).total_seconds()
        if timespan.total_seconds() == 0:
            return 0
        return usage / dayFactor

    def getDaysSummary(self, nrDays):
        values = []
        today = dt.datetime.combine(dt.date.today(), dt.time(tzinfo=tz))
        for i in range(nrDays, -1, -1):
            currDay = today - dt.timedelta(i)
            nextDay = currDay + dt.timedelta(1)
            usage = self.computeUsage(currDay, nextDay)

            q = """SELECT MIN(Date) as date, MAX(Date) as endDate, Min(outdoorTemp) as MinTemp, 
            MAX(outdoorTemp) as MaxTemp, AVG(outdoorTemp) as MeanTemp, AVG(pelletsLevel) as level 
            FROM pellets WHERE date>= '{0}' AND DATE <= '{1}'""".format(convertToDBLocal(currDay), convertToDBLocal(nextDay))
            res = self.db.execute(q).fetchone()
            if res == None or res['date'] == None or res['endDate'] == None:
                continue
            res['usage'] = usage
            res['date'] = convertToIsoformatWithTz(res['date'])
            res['endDate'] = convertToIsoformatWithTz(res['endDate'])
            values.append(res)
        return json.dumps(values).encode("utf8")

    def getRange(self, start, until):
        print( "start: '{0}'  until: '{1}'".format(start, until))
        query = "SELECT * FROM pellets "
        
        if start != None:
            start = convertToDBLocal(parse(start[0].decode("utf8")))
        if until != None:
            until = convertToDBLocal(parse(until[0].decode("utf8")))
        
        if start != None:
            query = query + "WHERE date >= '{0}'".format(start)
            if until != None:
                query = query + " AND date <= '{0}'".format(until)
        elif until != None:
            query = query + "WHERE date <= '{0}'".format(until)
        print("QUERY: " + query)
        ret = self.db.execute(query).fetchall()
        for row in ret:
            row['date']=convertToIsoformatWithTz(row['date'])
        print("response with {0} sql-lines".format(len(ret)))
        #append timecode
        return json.dumps(ret).encode("utf8")

    def render_GET(self, request):
        if len(request.args) < 1: return
        request.responseHeaders.addRawHeader(b"content-type", b"application/json")
        request.setHeader(b'Access-Control-Allow-Origin', b'*')
        print(request.args)
        if request.args.get(b'last') != None:
            request.setResponseCode(200)
            return self.getLast()

        if request.args.get(b'summary') != None:
            request.setResponseCode(200)
            return self.getDaysSummary(int(request.args.get(b'summary')[0])-1)

        start = request.args.get(b'from')
        if start == None:
            return
        until = request.args.get(b'until')
        request.setResponseCode(200)
        return self.getRange(start, until)

def main():
    if args.verbose:
        log.startLogging(sys.stdout)
    root = Resource()
    root.putChild(b"web", File("./web"))
    root.putChild(b"scripts", File("./scripts"))
    root.putChild(b"styles", File("./styles"))
    root.putChild(b"data",    DataFetching(args.database))

    factory = Site(root)
    endpoint = endpoints.TCP4ServerEndpoint(reactor, args.port)
    endpoint.listen(factory)
    reactor.run()

if __name__ == "__main__":
    # execute only if run as a script
    main()
