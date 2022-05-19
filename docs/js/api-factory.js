angular.module('pos', [])
    .factory('posApi', function($http) {
        return {
            readAppSettings: function() {
                return $http.get('appSettings.json');
            },
            login: function(model) {
                return $http.post('https://dev-ucozkq7z.eu.auth0.com/oauth/token', model);
            },
            reAuthenticate: function(model) {
                return $http.post('https://dev-ucozkq7z.eu.auth0.com/oauth/token', model);
            },
            fetchStripeConntectionToken: function() {
                return fetch('https://wema-pos-api.azurewebsites.net/ConnectionToken/generate', 
                    { 
                        method: "POST",
                        headers: {
                            Authorization: 'Bearer ' + JSON.parse(window.localStorage.getItem("token")).access_token
                        }
                    })
                    .then((response) => {
                        return response.json();
                    })
                    .then((data) => {
                        return data.secret;
                    })     
            },
            initiatePayment: function(amount) {
                var bodyContent = JSON.stringify({ amount: amount * 100 });
                $http.defaults.headers.common.Authorization = 'Bearer ' + JSON.parse(window.localStorage.getItem("token")).access_token;
                return $http.post('https://wema-pos-api.azurewebsites.net/CreatePaymentIntent/initialize', bodyContent);     
            },
            completePayment: function(paymentIntentId) {
                var bodyContent = JSON.stringify({ Id: paymentIntentId});
                $http.defaults.headers.common.Authorization = 'Bearer ' + JSON.parse(window.localStorage.getItem("token")).access_token;
                return $http.post('https://wema-pos-api.azurewebsites.net/CapturePaymentIntent/capture', bodyContent);
            },
            cancelPayment: function(paymentIntentId) {
                var bodyContent = JSON.stringify({ Id: paymentIntentId});
                $http.defaults.headers.common.Authorization = 'Bearer ' + JSON.parse(window.localStorage.getItem("token")).access_token;
                return $http.post('https://wema-pos-api.azurewebsites.net/CancelPaymentIntent/cancel', bodyContent);
            }
        }
});