var monthNames = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
var dayNames = ["S&oumlndag", "M&aringndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "L&oumlrdag"];

var detailedChartRangeInDays = 1;
var overviewChartRangeInDays = 7;
var detailedChartTimeout = null;
var overviewChartTimeout = null;

function changeChartRange(chartRange)
{
    if(chartRange <= 0)
        return;

    if(chartRange <= 5)
    {
        detailedChartRangeInDays = chartRange;
        if(detailedChartTimeout != null)
            clearTimeout(detailedChartTimeout);
        UpdateDetailedChartData();
    }
    else
    {
        overviewChartRangeInDays = chartRange;
        if(overviewChartTimeout != null)
            clearTimeout(overviewChartTimeout);
        UpdateOverviewChartData();
    }
}

function setupButtons()
{
    $("#OneDay").click(function() { changeChartRange(1); });
    $("#ThreeDays").click(function() { changeChartRange(3); });
    $("#FiveDays").click(function() { changeChartRange(5); });
    $("#OneWeek").click(function() { changeChartRange(7); });
    $("#TwoWeeks").click(function() { changeChartRange(14); });
    $("#OneMonth").click(function() { changeChartRange(30); });
    $("#TwoMonths").click(function() { changeChartRange(61); });
    $("#SixMonths").click(function() { changeChartRange(182); });
    $("#OneYear").click(function() { changeChartRange(365); });
    $("#Reload").click(function() { location.reload(true); });
}

function setFailedValues() {
    $("#boilerTempVal").html("-");
    $("#outerTempVal").html("-");
    $("#radiatorTempVal").html("-");
    $("#indoorTempVal").html("-");
    $("#storageVal").html("-");
    $("#statusVal").html("-");
    $("#usageVal").html("-");
    $("#pelletsleftVal").html("-");

    setBurning(false);

    setLed("#onoff", false);
    setLed("#alarm", false);
    setLed("#pelletsalarm", false);
}

function requestFailed() {
    setLedWarning("#communication");
    setLed("#database", false);
    setFailedValues();
}

function requestSuccess() {
    setLed("#communication");
}

function dbReadToOld() {
    setLedWarning("#database");
    setFailedValues();
}

function setLed(name, on) {

    var turnOn = true;
    if(typeof on !== "undefined") {turnOn = on;}

    $(name).toggleClass("led_off", !turnOn);
    $(name).removeClass("led_warning");
}

function setLedWarning(name, warning) {
    var turnOn = true;
    if(typeof warning !== "undefined") { turnOn = warning; }

    $(name).removeClass("led_off");
    $(name).toggleClass("led_warning", turnOn);
}


function setBurning(isBurning) {
    $("#status").toggleClass("fire", isBurning);
}

function dbReadOk(resp) {
    setLed("#database");
    var data = resp;

    var t = data["outdoorTemp"].toFixed(1);
    $("#outerTempVal").html((t > 0 ? "+" + t : t));
    $("#boilerTempVal").html(data["boilerTemp"].toFixed(1));
    $("#indoorTempVal").html(data["indoorTemp"].toFixed(1));
    $("#radiatorTempVal").html(data["supplyTemp"].toFixed(1));
    $("#storageVal").html(data["pelletsLevel"].toFixed(1));
    $("#statusVal").html(data["status"]);
    
    var usage = data["usage"];
    $("#usageVal").html( (usage / 16).toFixed(2) );

    if(usage > 0.1)
    {
        $("#pelletsleftVal").html( (data["pelletsLevel"] / usage).toFixed(1) );
    }
    else
    {
        $("#pelletsleftVal").html( "-" );
    }

    setBurning(data["status"].toUpperCase() != "Stby".toUpperCase());
    setLed("#onoff", data["onOff"]);
    setLedWarning("#alarm", data["alerts"] != 0);
    setLedWarning("#pelletsalarm", data["pelletsAlerts"] != 0);
}

function updateLastVals() {
    $.getJSON("/data", { last: true }, function (resp, reqstatus) {
        if (reqstatus == "success" && resp != null) {
            requestSuccess();
            data = resp;
            var time = new Date();
            var now = time.getTime();
            var dbTime = new Date(data["date"]);
            var dbMs = dbTime.getTime();
            $("#lastDbTime").html(dbTime.toDateString() + " " + dbTime.toLocaleTimeString());
            if (now - dbMs < 60000)
                dbReadOk(resp);
            else
                dbReadToOld();
        }
        else {
            requestFailed();
        }
        setTimeout("updateLastVals()", 10000);
    })

}

function updateDateTime() {
    // Create a newDate() object and extract the seconds of the current time on the visitor's
    var d = new Date();
    // Add a leading zero to seconds value
    var seconds = d.getSeconds();
    $("#sec").html((seconds < 10 ? "0" : "") + seconds);
    // Add a leading zero to the minutes value
    var minutes = d.getMinutes();
    $("#min").html((minutes < 10 ? "0" : "") + minutes);
    // Add a leading zero to the hours value
    var hours = d.getHours();
    $("#hours").html((hours < 10 ? "0" : "") + hours);

    // Output the day, date, month and year  
    $('#Date').html(dayNames[d.getDay()] + " " + d.getDate() + ' ' + monthNames[d.getMonth()] + ' ' + d.getFullYear());
}

function updateClock() {
    var currentTime = new Date();
    var currentHours = currentTime.getHours();
    var currentMinutes = currentTime.getMinutes();
    var currentSeconds = currentTime.getSeconds();
    // Pad the minutes and seconds with leading zeros, if required
    //currentMinutes = ( currentMinutes  < 0 ) ? currentHours - 12 : currentHours;
    // Convert an hours component of "0" to "12"
    currentHours = (currentHours == 0) ? 12 : currentHours;
    // Compose the string for display
    var currentTimeString = currentHours + ":" + currentMinutes + ":" + currentSeconds;
    $("#clock").html(currentTimeString);
}


var detailedOptions = {
    chart: {
        renderTo: 'detailedContainer',
    },
    title: null,
    time: {
        timezone: 'Europe/Stockholm'
    },
    xAxis: {
        type: 'datetime'
    },
    yAxis: [{ //primary axis
        softMin: 0,
        softMax: 0,
        minRange: 10.0,
        minPadding: 0,
        tickAmount: 5,
        labels: {
            x: 30,
            algin: 'left',
            format: '{value}°C',
            style: {
                color: Highcharts.getOptions().colors[0]
            }
        },
        title: {
            text: null,
            style: {
                color: Highcharts.getOptions().colors[0]
            }
        }
    }, 
    { //secondary axis
        tickPositions: [50,60,70,80,90],
        alignTicks : false,
        title: {
            text: null,
            style: {
                color: Highcharts.getOptions().colors[1]
            }
        },
        labels: {
            x: -30,
            algin: 'left',
            format: '{value}°C',
            style: {
                color: Highcharts.getOptions().colors[1]
            }
        },
        opposite: true
    }, { // Third yAxis
        tickPositions: [15,22.5,30,37.5,45],
        alignTicks : false,
        title: {
            text: null,
            style: {
                color: Highcharts.getOptions().colors[2]
            }
        },
        labels: {
            algin: 'right',
            format: '{value}°C',
            style: {
                color: Highcharts.getOptions().colors[2]
            }
        },
        opposite: true
    }
    ],
    tooltip: {
        shared: true
    },
    legend: {
        enabled: false,
        align: 'center',
        verticalAlign: 'bottom',
        floating: false,
        backgroundColor: (Highcharts.theme && Highcharts.theme.legendBackgroundColor) || '#FFFFFF'
    },
    series: [
        {
            name: "Utomhus",
            type: 'line',
            yAxis: 0,
            zIndex: 1,
            tooltip: { valueSuffix: '°C', valueDecimals: 1 },
            marker: {enabled:false}
        },
        {
            name: "Panna",
            type: 'line',
            yAxis: 1,
            zIndex: 2,
            tooltip: { valueSuffix: '°C', valueDecimals: 1 },
            marker: {enabled:false}
        },
        {
            name: "Radiator",
            type: 'line',
            yAxis: 2,
            zIndex: 0,
            tooltip: { valueSuffix: '°C', valueDecimals: 1 },
            marker: {enabled:false},
            color: Highcharts.getOptions().colors[2],

        }
    ]
};

var overviewOptions = {
    chart: {
        renderTo: 'overviewContainer',
    },
    title: null,
    time: {
        timezone: 'Europe/Stockholm'
    },
    xAxis: {
        type: 'datetime'
    },
    yAxis: [{ //primary axis
        softMin: 0,
        softMax: 0,
        minRange: 10.0,
        minPadding: 0,
        tickAmount: 5,
        labels: {
            algin: 'left',
            x: 30,
            format: '{value}°C',
            style: {
                color: Highcharts.getOptions().colors[0]
            }
        },
        title: {
            text: null,//'Utetemperatur',
            style: {
                color: Highcharts.getOptions().colors[0]
            }
        }
    }, { //secondary axis
        min: 0,
        softMax: 2.5,
        gridLineWidth: 0,
        tickAmount : 5,
        title: {
            text: null, //'Pelletsåtgång per dag',
            style: {
                color: Highcharts.getOptions().colors[6]
            }
        },
        labels: {
            x: -23,
            algin: 'right',
            format: '{value}',
            style: {
                color: Highcharts.getOptions().colors[6]
            }
        },
        opposite: true

    }, { // Third yAxis
        min: 0,
        max: 400,
        tickAmount : 5,
        gridLineWidth: 0,
        title: {
            text: null, //'Pellets',
            style: {
                color: Highcharts.getOptions().colors[4]
            }
        },
        labels: {
            algin: 'right',
            x: 3,
            format: '{value}kg',
            style: {
                color: Highcharts.getOptions().colors[4]
            }
        },
        tickLength: 0,
        opposite: true
    }, { // Fourth yAxis
        min: 85,
        max: 125,
        tickAmount : 5,
        gridLineWidth: 0,
        title: {
            text: null, //'Pellets',
            style: {
                color: Highcharts.getOptions().colors[3]
            }
        },
        labels: {
            algin: 'left',
            x: 0,
            format: '{value}°C',
            style: {
                color: Highcharts.getOptions().colors[3]
            }
        },
        tickLength: 0,
        opposite: false
    }],
    tooltip: {
        shared: true
    },
    legend: {
        legend: false,
        align: 'center',
        verticalAlign: 'bottom',
        floating: false,
        backgroundColor: (Highcharts.theme && Highcharts.theme.legendBackgroundColor) || '#FFFFFF'
    },
    series: [
        {
            name: "Medeltemp",
            type: 'spline',
            //data: averages,
            zIndex: 1,
            yAxis: 0,
            color: Highcharts.getOptions().colors[0],
            tooltip: { valueSuffix: '°C', valueDecimals: 1 },
            marker: {enabled:false}
        },
        {
            name: "Temperatur Min/Max",
            yAxis: 0,
            //data: ranges,
            type: "arearange",
            lineWidth: 0,
            linkedTo: ':previous',
            color: Highcharts.getOptions().colors[0],
            fillOpacity: 0.2,
            zIndex: 0,
            marker: {
                enabled: false
            },
            tooltip: { valueSuffix: '°C', valueDecimals: 1 }
        },
        {
            name: "Åtgång per dag",
            type: 'line',
            step: 'center',
            yAxis: 1,
            fillOpacity: 0.1,
            lineWidth: 1,
            tooltip: { valueSuffix: 'säckar', valueDecimals: 2 },
            color: Highcharts.getOptions().colors[6],
            marker: {enabled:false}
        },
        {
            name: "Pellets",
            type: 'line',
            yAxis: 2,
            tooltip: { valueSuffix: 'kg', valueDecimals: 1 },
            color: Highcharts.getOptions().colors[4],
            marker: {enabled:false}
        },
        {
            name: "Max Röktemp",
            type: 'line',
            yAxis: 3,
            tooltip: { valueSuffix: '°C', valueDecimals: 0 },
            color: Highcharts.getOptions().colors[3],
            marker: {enabled:false}
        }

    ]
};


function UpdateDetailedChartData() 
{
    var chartStartDate = new Date();
    chartStartDate.setDate(chartStartDate.getDate() - detailedChartRangeInDays);
    var timeStr = chartStartDate.toISOString();
    $.getJSON("/data", { from: timeStr }, function (data, reqstatus) {
        if (reqstatus == "success") {
            var boilerData = [];
            var outdoorData = [];
            var radiatorData = [];
            for(var i in data)
            {
                var entry = data[i];
                if(entry == null || entry['date'] == null)
                  continue;
                var date = new Date(entry['date']).valueOf();
                var bt = entry['boilerTemp'];
                var ot = entry['outdoorTemp'];
                var rt = entry['supplyTemp'];
                //var st = entry['pelletsLevel'];
                boilerData.push([date, bt]);
                outdoorData.push([date, ot]);
                radiatorData.push([date, rt]);
                //storageData.push([date, st]);
            }
            detailedOptions.series[0].data = outdoorData;
            detailedOptions.series[1].data = boilerData;
            detailedOptions.series[2].data = radiatorData;
        }
        else
        {
        }
        UpdateDetailedChart();
    })
}

function UpdateOverviewChartData() 
{
    $.getJSON("/data", { summary: overviewChartRangeInDays }, function (data, reqstatus) {
        if (reqstatus == "success") {
            var tempMinMaxData = [];
            var tempAvgData = [];
            var usageData = [];
            var storageData = [];
            var maxGasTempData = [];
            for(var i in data)
            {
                var entry = data[i];
                if(entry == null || entry['date'] == null)
                    continue;
                var date = new Date(entry['date']).valueOf();
                var minTemp = entry['MinTemp'];
                var maxTemp = entry['MaxTemp'];
                var avgTemp = entry['MeanTemp'];
                var usage = entry['usage'] / 16;
                var storage = entry['level'];
                var maxGasTemp = entry['MaxGasTemp'];
                //var st = entry['pelletsLevel'];
                tempMinMaxData.push([date, minTemp, maxTemp]);
                tempAvgData.push([date, avgTemp]);
                usageData.push([date, usage]);
                storageData.push([date, storage]);
                maxGasTempData.push([date, maxGasTemp]);
            }
            overviewOptions.series[0].data = tempAvgData;
            overviewOptions.series[1].data = tempMinMaxData;
            overviewOptions.series[2].data = usageData;
            overviewOptions.series[3].data = storageData;
            overviewOptions.series[4].data = maxGasTempData;
            //detailedOptions.series[2].data = storageData;
        }
        else
        {
        }
        UpdateOverviewChart();
    })
}


var detailedChart;
var overviewChart;

function UpdateDetailedChart() {
    detailedChart.update(detailedOptions, true);
    detailedChartTimeout = setTimeout(UpdateDetailedChartData, 600000); //update per 10 mins
};

function UpdateOverviewChart() {
    overviewChart.update(overviewOptions, true);
    overviewChartTimeout = setTimeout(UpdateOverviewChartData, 1800000); //update per 30 mins
}


function PelletsStartup()
{
    detailedChart = Highcharts.chart(detailedOptions);
    overviewChart = Highcharts.chart(overviewOptions);
    setupButtons();
    requestFailed();
    setInterval("updateDateTime()", 1000);
    updateLastVals();
    UpdateDetailedChartData();
    UpdateOverviewChartData();
}
