'use-strict'
/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/
const Alexa = require('alexa-sdk');
var https = require('https');
var async = require('asyncawait/async');
var await = require('asyncawait/await');

// 1. Text strings =====================================================================================================
//    Modify these strings and messages to change the behavior of your Lambda function

let speechOutput;
let reprompt;
const welcomeOutput = "Hello. Your trip advisor is here. I know a lot of information. You can start by saying let's plan a trip.";
const welcomeReprompt = "Let me know where you'd like to go or when you'd like to go on your trip";
const tripIntro = [
    "This sounds like a cool trip. ",
    "This will be fun. ",
    "Oh, I like this trip. "
];
var starting_state = "MA";
var city = "Andover";
var countryCode = "US";
var postalCode = 01810;
var addressLine1 = "21 Noel Rd";
var addressLine2 = "";
var addressLine3 = "";
var districtOrCounty =  "";


// 2. Skill Code =======================================================================================================

const APP_ID = undefined; // TODO replace with your app ID (OPTIONAL).
var myCoordinates = []
const handlers = {
    'LaunchRequest': function () {
        this.response.speak(welcomeOutput).listen(welcomeReprompt);
        this.emit(':responseReady');
    },
    'PlanMyTrip': function () {
        //get current addressLine1
        var getAddr = GetCurrentAddress.call( this, (addr_info) => {
            starting_state = addr_info[0];
            city = addr_info[1];
            countryCode = addr_info[2];
            postalCode = addr_info[3];
            addressLine1 = addr_info[4];
            addressLine2 = addr_info[5];
            addressLine3 = addr_info[6];
            districtOrCounty =  addr_info[7];
        });

        var start_addr = `${addressLine1} ${city} ${starting_state}`

        httpsGet_Geocode(start_addr, (start_geocode) => {
          myCoordinates = [start_geocode[0],start_geocode[1]]
        })

        //delegate to Alexa to collect all the required slot values
        var filledSlots = delegateSlotCollection.call(this);

        //compose speechOutput that simply reads all the collected slot values
        var speechOutput = randomPhrase(tripIntro);

        //activity is optional so we'll add it to the output
        //only when we have a valid activity
        var travelMode = isSlotValid(this.event.request, "travelMode");
        if (travelMode) {
            speechOutput += travelMode;
        } else {
            speechOutput += "You'll go ";
        }

        //Now let's recap the trip
        //Validate info
        var fromCity = this.event.request.intent.slots.fromCity.value;
        var toCity = this.event.request.intent.slots.toCity.value;
        var travelDate = this.event.request.intent.slots.travelDate.value;
        var address = this.event.request.intent.slots.places.value;
       // var make = this.event.request.intent.slots.make.value;
       // var model = this.event.request.intent.slots.model.value;
       // var year = this.event.request.intent.slots.year.value;
        speechOutput += `from ${fromCity} to ${address} , ${toCity} on ${travelDate}. `
        // Calling API
        httpsGet_Geocode(address, (geocode) => {
          var lat = geocode[0] // int
          var long = geocode[1] // int
          httpsGetmyGoogleplace(lat, long, "distance", "parking", (place) => {
            var parking_lat = place[0]
            var parking_long = place[1]
            var parking_rating = place[2]
            var parking_name = place[3]
            httpsGet_Matrix(lat, long, (matrix) => {
              var distancevalue = matrix[0] // int
              var distancetext = matrix[1]
              var durationvalue = matrix[2] // int
              var durationtext = matrix[3]
              httpsGetStats("honda", "civic", "2013", (stats) => {
                var year = stats[0] // int
                var mpg = stats[1]
                get_price(myCoordinates[0], myCoordinates[1], (price) => {
                  var gasPrice = price[0];
                  var distance = getMiles(distancevalue);
                  var gasCost = Math.ceil((gasPrice * distance) / 22)
                  speechOutput +=  ". The Lat is " + lat + " the long is " + long;
                  speechOutput += ". It will take " + durationtext + " to get there and be a distance of " + distancetext + " (" + distance + ")";
                  speechOutput += ". Year is " + year + " mpg is " + mpg
                  speechOutput += ". The closest parking garage to " + address + " is " + parking_name + " the rating is " + parking_rating;
                  speechOutput += ". The cost of gas will be $" + gasCost + " one way or $" + (gasCost*2) + " roundtrip."
                  this.response.speak(speechOutput);
                  this.emit(":responseReady")
                })
              })
            })
          })
        });
    },
    'AMAZON.HelpIntent': function () {
        speechOutput = "";
        reprompt = "";
        this.response.speak(speechOutput).listen(reprompt);
        this.emit(':responseReady');
    },
    'AMAZON.CancelIntent': function () {
        speechOutput = "";
        this.response.speak(speechOutput);
        this.emit(':responseReady');
    },
    'AMAZON.StopIntent': function () {
        speechOutput = "";
        this.response.speak(speechOutput);
        this.emit(':responseReady');
    },
    'SessionEndedRequest': function () {
        var speechOutput = "";
        this.response.speak(speechOutput);
        this.emit(':responseReady');
    },
};

exports.handler = (event, context) => {
    var alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    //alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

//    END of Intent Handlers {} ========================================================================================
// 3. Helper Function  =================================================================================================

function delegateSlotCollection() {
    console.log("in delegateSlotCollection");
    console.log("current dialogState: " + this.event.request.dialogState);
    if (this.event.request.dialogState === "STARTED") {
        console.log("in Beginning");
        var updatedIntent = this.event.request.intent;
        //optionally pre-fill slots: update the intent object with slot values for which
        //you have defaults, then return Dialog.Delegate with this updated intent
        // in the updatedIntent property
        this.emit(":delegate", updatedIntent);
    } else if (this.event.request.dialogState !== "COMPLETED") {
        console.log("in not completed");
        // return a Dialog.Delegate directive with no updatedIntent property.
        this.emit(":delegate");
    } else {
        console.log("in completed");
        console.log("returning: " + JSON.stringify(this.event.request.intent));
        // Dialog is now complete and all required slots should be filled,
        // so call your normal intent handler.
        return this.event.request.intent;
    }
}

function randomPhrase(array) {
    // the argument is an array [] of words or phrases
    var i = 0;
    i = Math.floor(Math.random() * array.length);
    return (array[i]);
}

function isSlotValid(request, slotName) {
    var slot = request.intent.slots[slotName];
    //console.log("request = "+JSON.stringify(request)); //uncomment if you want to see the request
    var slotValue;

    //if we have a slot, get the text and store it into speechOutput
    if (slot && slot.value) {
        //we have a value in the slot
        slotValue = slot.value.toLowerCase();
        return slotValue;
    } else {
        //we didn't get a value in the slot.
        return false;
    }
}

function GetCurrentAddress(callback) {
    if(this.event.context.System.user.permissions) {
      const token = this.event.context.System.user.permissions.consentToken;
      const apiEndpoint = this.event.context.System.apiEndpoint;
      const deviceId = this.event.context.System.device.deviceId;
      const das = new Alexa.services.DeviceAddressService();

      das.getFullAddress(deviceId, apiEndpoint, token)
      .then((data) => {
        var starting_state = data.stateOrRegion;
        var city = data.city;
        var countryCode = data.countryCode;
        var postalCode = data.postalCode;
        var addressLine1 = data.addressLine1;;
        var addressLine2 = data.addressLine2;
        var addressLine3 = data.addressLine3;
        var districtOrCounty =  data.districtOrCounty;
        callback([starting_state, city, countryCode, postalCode, addressLine1, addressLine2, addressLine3, districtOrCounty])
      })
      .catch((error) => {
          this.response.speak('I\'m sorry. Something went wrong.');
          this.emit(':responseReady');
          console.log(error.message);
      });
  } else {
      this.response.speak('Please grant skill permissions to access your device address through the Alexa app.');
      const permissions = ['read::alexa:device:all:address'];
      this.response.askForPermissionsConsentCard(permissions);
      console.log("Response: " + JSON.stringify(this.response));
      this.emit(':responseReady');
  }
}

// ======================== Custom functions ======================= //
//API KEY
var matrix_key = "AIzaSyBtVpXAuWlnuC7hicRdzFBzBifYR1evqIY";
var shine_key = "UKxbxhZYNEiP4spThYCy61bwEhRQXlPb";
var googleplace_key = "AIzaSyBtVpXAuWlnuC7hicRdzFBzBifYR1evqIY";
var google_key = "AIzaSyD-8QBhZNxZLnmX2AxBEOB2sSHzg4L2tZs";
var gas_key = "0tsuii9i8o";

// Geocode
function httpsGet_Geocode(myData, callback) {
    // Update these options with the details of the web service you would like to call
    var options = {
        host: 'maps.googleapis.com',
        port: 443,
        path: `/maps/api/geocode/json?address=${encodeURIComponent(myData)}&key=` + google_key,
        method: 'GET',
        // if x509 certs are required:
        // key: fs.readFileSync('certs/my-key.pem'),
        // cert: fs.readFileSync('certs/my-cert.pem')
    };
    var req = https.request(options, res => {
        res.setEncoding('utf8');
        var returnData = "";

        res.on('data', chunk => {
            returnData = returnData + chunk;
        });

        res.on('end', () => {
            // we have now received the raw return data in the returnData variable.
            // We can see it in the log output via:
            // console.log(JSON.stringify(returnData))
            // we may need to parse through it to extract the needed data
            var pop = JSON.parse(returnData);
            var lat = Number(pop.results[0].geometry.location.lat);
            var lng = Number(pop.results[0].geometry.location.lng);
            callback([lat, lng]);
            // this will execute whatever function the caller defined, with one argument
        });
    });
    req.end();
}

// Matrix
function getMiles(i) {
    return i * 0.000621371192;
}

function httpsGet_Matrix(lat, long, callback) {
    // Update these options with the details of the web service you would like to call
    var options = {
        host: 'maps.googleapis.com',
        port: 443,
        path: `/maps/api/distancematrix/json?units=imperial&origins=${myCoordinates[0]},${myCoordinates[1]}&destinations=${lat}%2C${long}&key=` + matrix_key,
        method: 'GET',
        // if x509 certs are required:
        // key: fs.readFileSync('certs/my-key.pem'),
        // cert: fs.readFileSync('certs/my-cert.pem')
    };

    var req = https.request(options, res => {
        res.setEncoding('utf8');
        var returnData = "";
        res.on('data', chunk => {
            returnData = returnData + chunk;
        });
        res.on('end', () => {
            // we have now received the raw return data in the returnData variable.
            // We can see it in the log output via:
            // console.log(JSON.stringify(returnData))
            // we may need to parse through it to extract the needed data
            var data = JSON.parse(returnData);
            var distancevalue = data.rows[0].elements[0].distance.value;
            var distancetext = data.rows[0].elements[0].distance.text;
            var durationvalue = data.rows[0].elements[0].duration.value;
            var durationtext = data.rows[0].elements[0].duration.text;
            callback([distancevalue, distancetext, durationvalue, durationtext]);
            // this will execute whatever function the caller defined, with one argument
        });
    });
    req.end();
}

// Shine Car Stats
function httpsGetStats(make, model, year, callback){
<<<<<<< HEAD
  var stats_options = {
    host: 'apis.solarialabs.com',
    path: '/shine/v1/vehicle-stats/specs?make=' + make + '&model=' + model + '&year=' + year + '&full-data=true&apikey=' + shine_key,
    method: 'GET'
  }
=======
    var stats_options = {
      host: 'apis.solarialabs.com',
      path: '/shine/v1/vehicle-stats/specs?make=' + make + '&model=' + model + '&year=' + year + '&full-data=true&apikey=' + shine_key,
      method: 'GET'
    }

    var req = https.request(stats_options, function(res) {
    res.setEncoding('utf-8');
>>>>>>> 4bba9af2606d6e2416e8ed69511a1af95352260d

  var req = https.request(stats_options, function(res) {
  res.setEncoding('utf-8');

  var responseString = '';

  res.on('data', function(data) {
      responseString += data;
  });


      res.on('end', function() {
          var response = JSON.parse(responseString);
          var stats_car_year = response[0].Model_Year
          var stats_car_mpg = response[0].City_Conventional_Fuel
          callback([stats_car_year, stats_car_mpg]);
        })
      })
      req.end();
  }

// Shine Car Theft
function httpsGet_CarTheft(state, callback) {
    // Update these options with the details of the web service you would like to call
    // this will return top 3rd that got stolen
    var options = {
        host: 'apis.solarialabs.com',
        port: 443,
        path: `/shine/v1/vehicle-thefts?state=${state}&rank=1&apikey=` + shine_key,
        method: 'GET',
        // if x509 certs are required:
        // key: fs.readFileSync('certs/my-key.pem'),
        // cert: fs.readFileSync('certs/my-cert.pem')
    };
    var req = https.request(options, res => {
        res.setEncoding('utf8');
        var returnData = "";

        res.on('data', chunk => {
            returnData = returnData + chunk;
        });

        res.on('end', () => {
            // we have now received the raw return data in the returnData variable.
            // We can see it in the log output via:
            // console.log(JSON.stringify(returnData))
            // we may need to parse through it to extract the needed data
            var data = JSON.parse(returnData);
            //carArray.push(data[0].Make)
            var make = data[0].Make
            var model = data[0].Model
            // this will execute whatever function the caller defined, with one argument
            callback([make, model]);
        });
    });
    req.end();

}
<<<<<<< HEAD

// MyGasFeed gets average price of gas around the starting location
function get_price(lat, long, callback) {
=======
// MyGasFeed
function get_price(lat, lng, callback) {
>>>>>>> 4bba9af2606d6e2416e8ed69511a1af95352260d
    let request = require('request')
    let options = {
        "url": `http://api.mygasfeed.com/stations/radius/${lat}/${long}/5/reg/price/0tsuii9i8o.json`,
        "method": "GET",
        "qs": {
            //"address": "2+old+english+village+apt+110",
            //"apikey": apiKey
        }
    }
    request(options, (err, resp, body) => {
        //go through the address components and geometry components.
        var data = JSON.parse(body);
<<<<<<< HEAD
        //console.log(data)
        var sum_price = 0;
        for(var i = 0; i < data.stations.length; i++)
        {
          sum_price += Number(data.stations[i].reg_price)
        }
        var avg_price = (sum_price/data.stations.length)
        callback([avg_price]);
=======
        var result = data.stations[0].reg_price;
        callback([result])
>>>>>>> 4bba9af2606d6e2416e8ed69511a1af95352260d
    })
}

// GooglePlace
<<<<<<< HEAD
function httpsGetmyGoogleplace(lat, long, rankby, types, callback) {
    var options = {
        host: 'maps.googleapis.com',
        port: 443,
        path: '/maps/api/place/nearbysearch/json?location=' + lat + ',' + long + '&rankby=' + rankby + '&type=' + types + '&key=' + googleplace_key,
=======
function httpsGetmyGoogleplace(lat, lng, rankby, types, callback) {
    // Update these options with the details of the web service you would like to call
    var options = {
        host: 'maps.googleapis.com',
        port: 443,
        //path: `/maps/api/geocode/json?address=${encodeURIComponent(myData)}&key=AIzaSyD-8QBhZNxZLnmX2AxBEOB2sSHzg4L2tZs`,
        path: `/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=${rankby}&types=${types}&key=` + googleplace_key,
>>>>>>> 4bba9af2606d6e2416e8ed69511a1af95352260d
        method: 'GET',
    };
    var req = https.request(options, res => {
        res.setEncoding('utf8');
        var returnData = "";
        res.on('data', chunk => {
            returnData = returnData + chunk;
        });
        res.on('end', () => {
<<<<<<< HEAD
            var pop = JSON.parse(returnData);
            var name = pop.results[0].name;
=======
            // we have now received the raw return data in the returnData variable.
            // We can see it in the log output via:
            // console.log(JSON.stringify(returnData))
            // we may need to parse through it to extract the needed
            var pop = JSON.parse(returnData);
            var name = pop.results[0].name
>>>>>>> 4bba9af2606d6e2416e8ed69511a1af95352260d
            var lat = Number(pop.results[0].geometry.location.lat);
            var lng = Number(pop.results[0].geometry.location.lng);
            var rate = pop.results[0].rating;
<<<<<<< HEAD
            callback([lat, long, rate, name])
=======
            callback([lat, lng, types, rate, name]);
            //var long = Number(pop.results[0].geometry.location.lng)
            //var type = pop.results[0].rating;
            //callback(long);
            //callback(type);
            // this will execute whatever function the caller defined, with one argument
>>>>>>> 4bba9af2606d6e2416e8ed69511a1af95352260d
        });
    });
    req.end();
}
