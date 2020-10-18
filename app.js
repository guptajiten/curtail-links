const express = require('express');
const cfg = require('./config/config');
const bodyParser = require('body-parser');
const mongoDB = require('mongoose');
const validUrl = require('valid-url');
const curTail= require('./js/curtailLink.js');
const redisDB = require('./js/redisClientFactory');

/***************DB Initialization**************/
mongoDB.Promise = global.Promise;
mongoDB.set('debug', true);
mongoDB.connect( cfg.dbUrl, {
    keepAlive: true,
    reconnectTries: Number.MAX_VALUE,
    useMongoClient: true,
},);
require('./js/curtailSchema');

/***************App Initialization**************/
const app = express();
//app.use(bodyParser.text({type: 'application/json'}));
app.use(bodyParser.json());
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-type,Accept,x-access-token,X-Key');
  if (req.method == 'OPTIONS') {
    res.status(200).end();
  } else {
    next();
  }
});

const curtailLinks = mongoDB.model('curtailSchema');

//GET - ShortToLongURL
//Given a shorter version of URL (returned in case 1), take user to original long URL
app.get(`/${cfg.shortBaseUrl}/:hash`, async (req, res) => {
  console.log(`Recieved GET request at /${cfg.shortBaseUrl}/:hash`);
  const hash = req.params.hash;
  if (hash == undefined || hash == ""){
    return res.redirect(cfg.errorUrl);
  }
  const item = await curtailLinks.findOne({ hash: hash });
  if (item) {
    return res.redirect(item.url);
  } else {
    return res.redirect(cfg.errorUrl);
  }
});

//POST - LongToShortURL
//Given original URL, return shorter version of it.
app.post(`/${cfg.shortBaseUrl}`, async (req, res) => {
  console.log(`Recieved POST request at /${cfg.shortBaseUrl}`);
  const { url } = req.body;
  const u_date = new Date();
  const options = { url };
  if (validUrl.isUri(url)) {
    let data;
    try {
      data = await redisDB.getFromCache('url', JSON.stringify(options));
      if (!data) {
        data = await curtailLinks.findOne(options).exec();
      }
      if (data) {
        res.status(200).json(data);
      } else {
        const hash = curTail.generate();
        const curtail = cfg.shortBaseUrl + '/' + hash;
        const orgURLLength = url.length;
        const curtailURLLength = curtail.length;
        if(orgURLLength >= curtailURLLength){
          console.log(`error..original url is already sorted`);
          return res.status(400).json('error..original url is already sorted');
        }
        const save_to_db = { url, curtail, hash, u_date };
        const item = new curtailLinks(save_to_db);
        await item.save();
        redisDB.addToCache('url', JSON.stringify(options), save_to_db);
        res.status(200).json(save_to_db);
      }
    } catch (err) {
      res.status(401).json('params invalid');
    }
  } else {
    return res.status(401).json('Invalid URL recieved');
  }
});

//Listeners
app.listen(cfg.apiPort, () => {
  console.log(`Server started on port`, cfg.apiPort);
  console.log(`Server listening GET request at /${cfg.shortBaseUrl}/:code`);
  console.log(`Server listening POST request at /${cfg.shortBaseUrl}`);
});