const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');

const app  = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/api', (req, res) => res.send('Hello'));

app.post('/api/submitData', (req, res) => {
    fs.appendFile('yuce.json', JSON.stringify(req.body)+',\n', 'utf8', err => {
        if(err) res.send(err);
		else res.send('success');
    });
});

app.listen(36524);

// var t = 
// {
//     time: 'timeStamp',
//     place: 'wenmiao',
//     num: 0, // 排队人数
//     options: {
//         carId: 0,
//         remaining: 0,
//     }
// }