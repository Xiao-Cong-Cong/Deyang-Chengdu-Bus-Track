const fs = require('fs');
const axios = require('axios');
const sd = require('silly-datetime');

var bus = [];

function work() {
    var myDate = new Date(new Date().getTime() + 13*60*60*1000);
    var h = myDate.getHours();
    if(h > 0 && h < 6) { bus = []; return; }
	
    var date = sd.format(myDate - 3600000, 'YYYY-MM-DD');
    var time = sd.format(myDate, 'YYYY-MM-DD HH:mm:ss');
	var baseTime = new Date(date + ' 00:00:00');
	var filePath = './data/' + date + '.json';
	
    axios.get('http://gps.scyhrt.com/gps/vehicle/getBusToGPSVehiclePositions')
        .then(res => {			
			// Process Data
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
				var now = (Date.parse(d.list[i].gpsTime) - baseTime) / 1000;
				if(j === tot) console.log("Can not find the bus " + d.list[i].cph);
				else if(!bus[j].data.length || now > bus[j].data[bus[j].data.length-1].t)
					bus[j].data.push({
						t: now,
						x: d.list[i].lon,
						y: d.list[i].lat,
						v: d.list[i].velocity
					});
			}
			
			// Truncate data when the bus is static 
			for(var i = 0; i < tot; i++) {
				var d = bus[i].data;
				var l = d.length;
				if(l-3 >= 0 && d[l-3].x === d[l-2].x && d[l-2].x === d[l-1].x &&
							   d[l-3].y === d[l-2].y && d[l-2].y === d[l-1].y &&
							   d[l-3].v === 0 && d[l-2].v === 0 && d[l-1].v === 0)
					d.splice(l-2, 1);
			}
			
			fs.writeFile(filePath, JSON.stringify(bus), 'utf8', err => {
				if(err) console.log(time + ' Write data file error: ' + err);
			})
        }).catch(err => {
			console.log(time + ' axios error:' + err);
        });
}

setInterval(work, 3000);