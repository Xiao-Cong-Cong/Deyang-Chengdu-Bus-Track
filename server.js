const fs = require('fs');
const axios = require('axios');
const sd = require('silly-datetime');

function work() {
    var t = new Date().getTime();
    var myDate = new Date(t + 13*60*60*1000);
    var h = myDate.getHours();
    if(h > 0 && h < 6) return;
    var date = sd.format(myDate - 3600000, 'YYYY-MM-DD');
    var time = sd.format(myDate, 'YYYY-MM-DD HH:mm:ss');
    axios.get('http://gps.scyhrt.com/gps/vehicle/getBusToGPSVehiclePositions')
        .then(res => {
            var filePath = './rawData/' + date + '.json';
            var str = JSON.stringify({time: time,  data: res.data}) + ',\n';
            fs.appendFile(filePath, str, 'utf8', err => {
                if (err) console.log(time + ' Append file error: ' + err);
            });
        }).catch(err => {
            console.log(time + ' axios error:' + err);
        });
}

setInterval(work, 6000);