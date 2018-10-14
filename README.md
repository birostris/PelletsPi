# PelletsPi
Pellets logger and webserver for Ariterm Biomatic 20i

The project constists of a data collector, a webserver and a website visualizing the data
The project is under development and no responsibility is taken that it works perfect or does no harm to the raspberry in the Ariterm boiler.
Even though this readme is written in english - the website shown in this project is purely in swedish.

# Usage
In two different screens:
* start the collector: `python3 pellets.py 192.168.2.204 logger@BM20Pxxxxxx your_pwd_on_boiler`
* start the webserver: `python3 server.py` 

Both pellets.py and server.py have --help or -h command line help to show more options.

## Dependencies
The scripts are written in Python and tested on python v3.5.6
```
pip3 install twisted          (tested with v18.7.0)
pip3 install python-dateutil  (tested with v2.7.3)
pip3 install requests         (tested with v2.19.1)
```

## Information
### The collector - pellets.py
The data collector connects to the boiler raspberry web interface and requests data at a regular interval.
The data is stored in a sqlite database by modifying the last row or appended to the database if a time threshold is hit or when the status of the boiler is changed, i.e. goes from standby to ignition.
If login to the boiler fails it will retry a couple of times and then throw an exception.
It is good practice to create a "user" account on the boiler that is soley used for the logging.

### The webserver - server.py
The webserver uses Twisted as webserver and provides data from the database using requests. 
Requests are using endpoints 
* `/data?last=true` gives the last stored value in the database 
* `/data?from=#######` gives all entries in database since the ISO-formatted timestamp. 
* `/data?summary=##` gives summary data for the amount of days set. Summary data consists of min,max,avg outdoor temp, storage level and pellets usage per day

### The website - pellets.html and pellets.js
The website shows a selection of the last data in the database, with warning and error indicators.
The date shown on top is the date from the last entry of the database.
* The server-light will turn red if the webserver is not functional.
* The database-light will turn red if the last entry is to old - an indication that pellets.py script is not working fine, and might need to be restarted.
* The förråd-light will turn red when there is an alarm from the storage, i.e. low level of pellets.
* The panna-light will turn red when there is an alarm from the boiler.
* The av/på-light will be green or off depending on the boilder on/off state.
Charting is done using highcharts.




