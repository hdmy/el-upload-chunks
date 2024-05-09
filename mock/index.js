/**
 * Created with VSCode
 * User: Holan
 * Date: 2018-06-06
 * Description: Mock Server | Express | Mockjs
 *
 * e.g: get/post "localhost:port/mock/example/json" => file ./response/example/json.json
 * e.g: get/post "localhost:port/mock/example/js" => file ./response/example/js.js
 */

var path = require('path')
var express = require('express');
var expressMock = require('express-mockjs-middleware');
const port = 3333
var app = express();

app.use('/mock', expressMock(path.resolve(__dirname, './response')));
module.exports = app.listen(port, function (err) {
  if (err) {
    console.log(err)
    return
  }
  var uri = 'http://localhost:' + port
  console.log('Mock Server Listening at ' + uri + '\n')
})
