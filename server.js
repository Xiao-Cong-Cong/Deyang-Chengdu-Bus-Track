const fs = require('fs');
const axios = require('axios');
const sd = require('silly-datetime');

function work() {
	// Download Data
    var t = new Date().getTime();
    var myDate = new Date(t + 13*60*60*1000);
    var h = myDate.getHours();
    if(h > 0 && h < 6) return;
    var date = sd.format(myDate - 3600000, 'YYYY-MM-DD');
    var time = sd.format(myDate, 'YYYY-MM-DD HH:mm:ss');
    axios.get('http://gps.scyhrt.com/gps/vehicle/getBusToGPSVehiclePositions')
        .then(res => {
            var rawFilePath = './rawData/' + date + '.json';
            var str = JSON.stringify({time: time,  data: res.data}) + ',\n';
            fs.appendFile(rawFilePath, str, 'utf8', err => {
                if (err) console.log(time + ' Append raw data file error: ' + err);
            });
			
			// Process Data
			var baseTime = new Date(date + ' 00:00:00');
			var filePath = './data/' + date + '.json';
			var bus = [];
			fs.readFile(filePath, (err, data) => {
				if(err) {
					console.log(time + ' Read file error: ' + err);
				} else {
					bus = JSON.parse(data);
				}
				var d = res.data.data;
				var tot = d.total;
				if(!bus.length) {
					for(var i = 0; i < tot; i++) {
						bus.push({
							id: d.list[i].id,
							cph: d.list[i].cph,
							startMile: d.list[i].runMile,
							data: []
						});
					}
				}
				for(var i = 0; i < tot; i++) {
					for(var j = 0; j < tot; j++)
						if(bus[j].id === d.list[i].id) break;
					if(j === tot) console.log("Can not find the bus " + d[i].cph);
					else if(!bus[j].data.length || Date.parse(d.list[i].gpsTime) > bus[j].data[bus[j].data.length-1].t)
						bus[j].data.push({
							t: (Date.parse(d.list[i].gpsTime) - baseTime)/1000,
							x: d.list[i].lon,
							y: d.list[i].lat,
							v: d.list[i].velocity
						});
				}
				fs.writeFile(filePath, JSON.stringify(bus), 'utf8', err => {
					if(err) console.log(time + ' Write data file error: ' + err);
				})
			});
        }).catch(err => {
            console.log(time + ' axios error:' + err);
        });
		

	
}

setInterval(work, 3000);