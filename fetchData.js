const fs = require('fs');
const axios = require('axios');
const sd = require('silly-datetime');
const cph = ["川F00055D", "川F00019D", "川F00186D", "川F00881D", "川F00031D",
			 "川F00065D", "川F00016D", "川F00058D", "川F00056D", "川F00076D",
			 "川F00067D", "川F00035D", "川F00020D", "川F00050D", "川F00075D",
			 "川F00013D", "川F00071D", "川F00036D", "川F00021D", "川F10086D"];
// TODO: consider using id instead of cph

var bus = [];
var count = 0;

function work() {
	count++;
	
	var BJtime = Date.now() + (480 + new Date().getTimezoneOffset()) * 60 * 1000;
    var myDate = new Date(BJtime);
    var h = myDate.getHours();
    if(h > 0 && h < 6) { bus = []; return; }
	
    var date = sd.format(myDate - 3600000, 'YYYY-MM-DD');
    var time = sd.format(myDate, 'YYYY-MM-DD HH:mm:ss');
	var rawFilePath = './rawData/' + date + '.json';
	var baseTime = new Date(date + ' 00:00:00');
	var filePath = './data/' + date + '.json';
	
    axios.get('http://gps.scyhrt.com/gps/vehicle/getBusToGPSVehiclePositions')
        .then(res => {
			// Save raw data every 6 seconds
			if(count % 3 === 1) {
				var str = JSON.stringify({time: time,  data: res.data}) + ',\n';
				fs.appendFile(rawFilePath, str, 'utf8', err => {if(err) console.log(err)});
			}
			
			// Process data
			var d = res.data.data;
			var tot = d.total;
			var l = d.list;
			
			// Init bus
			if(!bus.length) {
				try {
					// Try to restore data
					bus = JSON.parse(fs.readFileSync(filePath));
				} catch (err) {
					// Create bus from fetched data
					for(var i = 0; i < tot; i++)
						bus.push({
							id: l[i].id,
							cph: l[i].cph,
							startMile: l[i].runMile,
							cphId: cph.indexOf(l[i].cph) + 1,
							data: []
						});
				}
			}
			
			// Write new data to bus
			for(var i = 0; i < tot; i++) {
				for(var j = 0; j < bus.length; j++) if(bus[j].id === l[i].id) break;
				var now = (Date.parse(l[i].gpsTime) - baseTime) / 1000;
				if(j === bus.length) console.log(time + " Can not find the bus " + l[i].cph);
				else if(!bus[j].data.length || now > bus[j].data[bus[j].data.length-1].t) {
					bus[j].data.push({
						t: now,
						x: l[i].lon,
						y: l[i].lat,
						v: l[i].velocity
					});
				}
			}
			
			// Truncate data when the bus is static 
			for(var i = 0; i < bus.length; i++) {
				var d = bus[i].data;
				var l = d.length;
				if(l-3 >= 0 && d[l-3].x === d[l-2].x && d[l-2].x === d[l-1].x &&
							   d[l-3].y === d[l-2].y && d[l-2].y === d[l-1].y &&
							   d[l-3].v === 0 && d[l-2].v === 0 && d[l-1].v === 0)
					d.splice(l-2, 1);
			}
			
			// Save bus every 2 seconds
			fs.writeFile(filePath, JSON.stringify(bus), 'utf8', err => {if(err) console.log(err)});
        }).catch(err => {
            console.log(time + ' Can not get bus position: ' + err);
        });
}

setInterval(work, 2000);
