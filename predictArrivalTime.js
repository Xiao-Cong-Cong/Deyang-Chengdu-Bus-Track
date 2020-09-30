const points = [
	{x: 104.3905, y: 31.1690},	// 0 充电
	{x: 104.3935, y: 31.1720},
	{x: 104.3896, y: 31.1261},	// 1 文庙出发
	{x: 104.3916, y: 31.1272},
	{x: 104.1935, y: 30.8166},	// 2 到达新都
	{x: 104.1970, y: 30.8174},
	{x: 104.1950, y: 30.8163},	// 3 新都出发
	{x: 104.1962, y: 30.8168},
	{x: 104.3930, y: 31.1260},	// 4 到达文庙
	{x: 104.3945, y: 31.1269},
	{x: 104.3755, y: 31.1305},	// 5 文庙等待
	{x: 104.3820, y: 31.1350},
	{x: 104.1940, y: 30.8180},	// 6 新都等待
	{x: 104.1980, y: 30.8240}];
const poi = [ 
	{x: 104.3935, y: 31.1267},	// 0 文庙
	{x: 104.1962, y: 30.8168},	// 1 新都
	{x: 104.3896, y: 31.1021},	// 2 文庙去五洲广场
	{x: 104.3895, y: 31.1010}];	// 3 五洲广场去文庙
const transfer = [
	{from: [-1,  1,2,3,4,5,6], maxV: 0},
	{from: [-1,0,  2,3,4,5,6], maxV: 0},
	{from: [-1,0,1,    4,5  ], maxV: 99},
	{from: [-1,0,1,2,  4,5,6], maxV: 0},
	{from: [-1,    2,3,    6], maxV: 99},
	{from: [-1,0,1,2,3,4,  6], maxV: 0},
	{from: [-1,0,1,2,3,4,5  ], maxV: 0}];

const fs = require('fs');
const axios = require('axios');
const sd = require('silly-datetime');

var myBus = [], date, now;
var runningBus = [], time;

function work() {
	var BJtime = Date.now() + (480 + new Date().getTimezoneOffset()) * 60 * 1000;
	var myDate = new Date(BJtime);
	var h = myDate.getHours();
	if(h > 0 && h < 6) { myBus = []; runningBus = []; return; }
	
	date = sd.format(myDate - 3600000, 'YYYY-MM-DD');
	time = sd.format(myDate, 'YYYY-MM-DD HH:mm:ss');
	now = Math.round((BJtime - Date.parse(date + ' 00:00:00')) / 1000);
	
	try {	// Get bus data
		var bus = JSON.parse(fs.readFileSync('./data/' + date + '.json'));
		if(!myBus.length) myBus = bus;
		else {
			for(var i = 0; i < bus.length; i++) {
				for(var j = 0; j < myBus.length; j++) if(bus[i].id === myBus[j].id) break;
				if(j === myBus.length) console.log(time + " Can not find ", bus[i].cph);
				else myBus[j].data = bus[i].data, myBus[j].p = 0;
			}
		}
		myBus.forEach(b => b.area = {a: -1, s: 0});
	} catch (err) {
		console.log(time + ' Get bus data error: ' + err);
		return;
	}
	
	var predictList = [];
	// Calculate recent 2 hours
	for(var t = now - 7200; t <= now; t++)
		for(var i = 0; i < myBus.length; i++) {
			var b = myBus[i];
			while(b.p < b.data.length && b.data[b.p].t < t) b.p++;
			if(b.p < b.data.length && b.data[b.p].t === t) {
				// Update bus status	// Leave area
				if(b.area.s && !contain(b.area.a, b.data[b.p].x, b.data[b.p].y)) {
					b.area.s = 0;
					if(b.area.a === 1 || b.area.a === 3) {
						predictList.push({
							busId: i,
							startTime: t,
							cphId: b.cphId,
							from: b.area.a === 1 ? 0 : 1
						});
					}
				}	// Enter area
				for(var j = 0; j < 7; j++) {
					if(contain(j, b.data[b.p].x, b.data[b.p].y) &&
						transfer[j].from.includes(b.area.a) &&
						b.data[b.p].v <= transfer[j].maxV) {
							b.area = { a: j, s: 1 };
							for(var k = 0; k < predictList.length; k++) {
								if(predictList[k].busId === i)
									if((!predictList[k].from && j !== 4) || predictList[k].from) {
										predictList.splice(k, 1); break;
									}
							}
						}
				}
			}
		}
		
	// Exclude bus going to charge
	for(var i = predictList.length - 1; i >= 0; i--) {
		var d = myBus[predictList[i].busId].data;
		if(d[d.length-1].y > 31.1312) predictList.splice(i, 1);
	}
	
	// Exclude `runningBus` that can not find in `predictList`
	for(var i = runningBus.length - 1; i >= 0; i--) {
		for(var j = 0; j < predictList.length; j++)
			if(runningBus[i].busId === predictList[j].busId) break;
		if(j === predictList.length) runningBus.splice(i, 1);
	}
	
	// Predict bus every 5 minutes
	for(var i = 0; i < predictList.length; i++) {
		var busId = predictList[i].busId;
		if(!myBus[busId].lastUpdate || now - myBus[busId].lastUpdate >= 300) {
			for(var j = 0; j < runningBus.length; j++)
				if(runningBus[j].busId === busId) break;
			if(j === runningBus.length) runningBus.push(predictList[i]);
			predict(j);			
		}
	}
	
	// Save runningBus
	fs.writeFile('./dy3/runningBus.json', JSON.stringify(runningBus), 'utf8', err => {if(err) console.log(err)});
}

function contain(i, x, y) {
	return points[i*2].x <= x && x <= points[i*2+1].x &&
		   points[i*2].y <= y && y <= points[i*2+1].y;
}

function predict(runningBusId) {
	var b = runningBus[runningBusId];
	var d = myBus[b.busId].data, wpo = '';
	
	var ori = d[d.length-1].x+','+d[d.length-1].y;
	var des = poi[b.from^1].x+','+poi[b.from^1].y;
	if(!b.from && d[d.length-1].y > 31.103) wpo = poi[2].x+','+poi[2].y;
	if( b.from && d[d.length-1].y < 31.100) wpo = poi[3].x+','+poi[3].y;
	
	var url = 'http://restapi.amap.com/v3/direction/driving?origin='+ori+'&destination='+des+
			  '&waypoints='+wpo+'&s=rsv3&key=74ad0628ee4b58175f67dc5068bb8b5a&nosteps=1';
	
	// Call Amap driving
	axios.get(url).then(res => {
		if(!res.data.status) console.log(time + ' Get Amap data err: ' + res.data.info);
		else {
			var p = res.data.route.paths[0];
			b.predictTime = d[d.length-1].t + parseInt(p.duration);
			b.leftDistance = parseInt(p.distance);
			myBus[b.busId].lastUpdate = now;
			
			// Log successful prediction
			var str = JSON.stringify({time: d[d.length-1].t, data: b}) + ',\n';
			fs.appendFile('./pred/' + date + '.json', str, 'utf8', err => {if(err) console.log(err)});
		}
	}).catch(err => {console.log(time + ' Amap axios error: ' + err)});
}

setInterval(work, 5000);