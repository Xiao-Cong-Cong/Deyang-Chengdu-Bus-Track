const points = [
	{x: 104.3905, y: 31.1690},	// 0 充电
	{x: 104.3935, y: 31.1720},
	{x: 104.3896, y: 31.1265},	// 1 文庙出发
	{x: 104.3912, y: 31.1272},
	{x: 104.1935, y: 30.8166},	// 2 到达新都
	{x: 104.1970, y: 30.8174},
	{x: 104.1950, y: 30.8163},	// 3 新都出发
	{x: 104.1962, y: 30.8168},
	{x: 104.3930, y: 31.1260},	// 4 到达文庙
	{x: 104.3945, y: 31.1269},
	{x: 104.3755, y: 31.1305},	// 5 文庙等待
	{x: 104.3820, y: 31.1350},
	{x: 104.1940, y: 30.8180},	// 6 新都等待
	{x: 104.1980, y: 30.8240},
];
const transfer = [
	{from: [-1,  1,2,3,4,5,6], maxV: 0},
	{from: [-1,0,  2,3,4,5,6], maxV: 0},
	{from: [-1,0,1,    4,5  ], maxV: 99},
	{from: [-1,0,1,2,  4,5,6], maxV: 0},
	{from: [-1,    2,3,    6], maxV: 99},
	{from: [-1,0,1,2,3,4,  6], maxV: 0},
	{from: [-1,0,1,2,3,4,5  ], maxV: 0},
];
const chepaihao = ["川F00055D", "川F00019D", "川F00186D", "川F00881D", "川F00031D", "川F00065D", "川F00016D", "川F00058D", "川F00056D", "川F00076D"];

const fs = require('fs');
const axios = require('axios');
const sd = require('silly-datetime');

var bus = [];
var date = '';
var time = '';
var baseTime = 0;
var runningBus = [];

function work() {
    var myDate = new Date(getBeijingTime());
    var h = myDate.getHours();
    if(h > 0 && h < 6) { bus = []; runningBus = []; return; }
	
    date = sd.format(myDate - 3600000, 'YYYY-MM-DD');
    time = sd.format(myDate, 'YYYY-MM-DD HH:mm:ss');
	baseTime = new Date(date + ' 00:00:00');
	
    axios.get('http://gps.scyhrt.com/gps/vehicle/getBusToGPSVehiclePositions')
        .then(res => {			
			// Process Data
			var d = res.data.data;
			var tot = d.total;
			var l = d.list;
			
			// init bus
			if(!bus.length) {
				for(var i = 0; i < tot; i++) {
					bus.push({
						id: l[i].id,
						cph: l[i].cph,
						startMile: l[i].runMile,
						cphId: chepaihao.indexOf(l[i].cph) + 1,
						area: {a: -1, s: 0},
						data: []
					});
				}
			}
			
			var timeArray = [];
			for(var i = 0; i < tot; i++) {
				for(var j = 0; j < tot; j++) if(bus[j].id === l[i].id) break;
				var now = (Date.parse(l[i].gpsTime) - baseTime) / 1000;
				if(j === tot) console.log("Can not find the bus " + l[i].cph);
				else if(!bus[j].data.length || now > bus[j].data[bus[j].data.length-1].t) {
					bus[j].data.push({
						t: now,
						x: l[i].lon,
						y: l[i].lat,
						v: l[i].velocity
					});
				}
				timeArray.push(now);
			}
			timeArray.sort();
			
			for(var ti = 0; ti < timeArray.length; ti++) {
				var t = timeArray[ti];
				for(var i = 0; i < bus.length; i++) {
					var bd = bus[i].data;
					if(t === bd[bd.length-1].t) update(i, t, bd.length-1);
				}
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
			
			fs.writeFile('./data/' + date + '.json', JSON.stringify(bus), 'utf8', err => {});
        }).catch(err => {
			console.log(time + 'Can not get bus position: ' + err);
        });
}

function update(busId, time, p) {
	var car = bus[busId];
	if(car.area.s && !contain(car.area.a, car.data[p].x, car.data[p].y)) {
		car.area.s = 0;
		if(car.area.a === 1 || car.area.a === 3) {
			runningBus.push({
				busId: busId,
				cphId: car.cphId,
				from: car.area.a === 1 ? 0 : 1,
				leftDistance: 0,
				startTime: time,
				predictTime: 0
			});
			predict(busId);
		}
	}
	for(var j = 0; j < 7; j++) {
		if(contain(j, car.data[p].x, car.data[p].y) && 
		   transfer[j].from.includes(car.area.a) &&
		   car.data[p].v <= transfer[j].maxV) {
			car.area = { a: j, s: 1 };
			for(var i = 0; i < runningBus.length; i++)
				if(runningBus[i].busId === busId)
					if((runningBus[i].from === 0 && j !== 4) || runningBus[i].from === 1) {
						runningBus.splice(i, 1);
						break;
					}						
		}
	}
}

function contain(i, x, y) {
	return points[i*2].x <= x && x <= points[i*2+1].x &&
		   points[i*2].y <= y && y <= points[i*2+1].y;
}

function predict(busId) {
	for(var i = runningBus.length-1; i >= 0; i--) {
		var d = bus[runningBus[i].busId].data;
		if(d[d.length-1].y > 31.1312) runningBus.splice(i,1);
	}
	
	var poi = [ {x: 104.3935, y: 31.1267},
				{x: 104.1962, y: 30.8168},
				{x: 104.3896, y: 31.1021},
				{x: 104.3895, y: 31.1010} ];
				
	for(var i = 0; i < runningBus.length; i++)
		if(runningBus[i].busId === busId) {
			var b = runningBus[i];
			var d = bus[busId].data;
			var ori = d[d.length-1].x+','+d[d.length-1].y;
			var des = poi[b.from^1];
			var wpo = '';
			if(!b.from && d[d.length-1].y > 31.103) wpo = poi[2];
			if(b.from && d[d.length-1].y < 31.100) wpo = poi[3];
			var url = 'http://restapi.amap.com/v3/direction/driving?origin='+ori+'&destination='+des+
					  '&waypoints='+wpo+'&s=rsv3&key=74ad0628ee4b58175f67dc5068bb8b5a&nosteps=1';
			axios.get(url).then(res => {
				if(!res.data.status) console.log(time + 'Get amap data err: ' + res.data.info);
				var p = res.data.route.paths[0];
				var t = Math.round((getBeijingTime() - baseTime) / 1000);
				b.predictTime = t + p.duration;
				b.leftDistance = p.distance;
				
				// write log
				var str = JSON.stringify({t: t, i: bus[busId].id, f: b.from, d: b.leftDistance, p: b.predictTime});
				fs.appendFile('./pred/' + date + '.json', str, 'utf8', err => {});
				
				// write runningBus
				fs.writeFile('./dy3/runningBus.json', JSON.stringify(runningBus), 'utf8', err => {});
			}).catch(err => {console.log(time + 'Amap axios error: ' + err);});
		}
}

function getBeijingTime() {
	return Date.now() + (480 + new Date().getTimezoneOffset()) * 60 * 1000;
}

setInterval(work, 6000);