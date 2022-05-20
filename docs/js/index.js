(function() {
    angular.module('wema-pos', ['pos'])
        .controller('pos-controller', function(posApi, $q) {
            var terminal = null;
            var paymentIntentId = null;
            var logInTime = null; 
            var logInToEpoch = null;

            var vm = this; 
            
            vm.amount = null; 

            vm.states = {
                login: {
                    index: 0,
                },
                payment: {
                    index: 1,
                },
                finished: {
                    index: 2,
                }

            };

            

            if (JSON.parse(window.localStorage.getItem("token")) == undefined) {
                vm.currentState = vm.states.login;
            } else {
                reAuthentication();
                vm.currentState = vm.states.payment;
            }

            vm.login = function(pm) {
                posApi.readAppSettings()
                .then((response) => {
                    authSettings = response.data.Auth0;
                    
                    var model = {
                        client_id: authSettings.client_id,
                        client_secret: authSettings.client_secret,
                        grant_type: authSettings.grant_type,
                        username: pm.username,
                        password: pm.password,
                        audience: authSettings.audience,
                        scope: authSettings.scope
                    };

                    posApi.login(model)
                    .then((authResponse) => {
                        return authResponse;
                    })
                    .then((authResponse) => {                    
                        logInTime = new Date(); 
                        logInToEpoch = Math.round(logInTime.getTime() / 1000);
                        window.localStorage.setItem("loggedInToken", logInToEpoch);
                        window.localStorage.setItem("token", JSON.stringify(authResponse.data));
                        window.localStorage.setItem("refresh_token", JSON.stringify(authResponse.data.refresh_token));
                        connectToReader();
                        
                        
                    }).catch((error) => {
                        //TO-DO: Show error to user
                        console.log(error);
                    }); ;                 
                 })
                 .catch((error) => {
                     //TO-DO: Show error to user
                     console.log(error);
                 }); 
            };

            vm.requestPayment = function(amount) {
                posApi.initiatePayment(amount)
                .then((response) => {
                    var secret = response.data.secret;
                    var collectPaymentPromise = terminal.collectPaymentMethod(secret);               
                    $q.when(collectPaymentPromise)
                    .then((result) => {
                        if (result.error) {
                            console.log(result.error);
                        } else {
                            console.log('terminal.collectPaymentMethod', result.paymentIntent);
                            var processPaymentPromise = terminal.processPayment(result.paymentIntent);
                            $q.when(processPaymentPromise)
                            .then((processedPaymentResult) => {
                                if (processedPaymentResult.error) {
                                    console.log(processedPaymentResult.error)
                                } else if (processedPaymentResult.paymentIntent) {
                                    paymentIntentId = processedPaymentResult.paymentIntent.id;
                                    console.log('terminal.processPayment', processedPaymentResult.paymentIntent);
                                    vm.changeState('finished');
                                }
                            })
                        }
                    })
                })
                .catch((error) => {
                    //TO-DO: Show error to user
                    console.log(error);
                }); 
            };

            vm.completePayment = function() {
                posApi.completePayment(paymentIntentId)
                .then(() => {
                    vm.changeState('payment');
                })
                .catch((error) => {
                    //TO-DO: Show error to user
                    console.log(error);
                });
            };

            vm.cancelPayment = function() {
                posApi.cancelPayment(paymentIntentId)
                .then(() => {
                    vm.changeState('payment');
                })
                .catch((error) => {
                    //TO-DO: Show error to user
                    console.log(error);
                });
            };

            vm.changeState = function(newState) {
                switch(newState) {
                    case 'login':
                        vm.currentState = vm.states.login;
                        break;
                    case 'payment':
                        vm.amount = null;
                        vm.currentState = vm.states.payment;
                        break;
                    case 'finished':
                        vm.currentState = vm.states.finished;
                        break;
                }
            };

            function fetchConnectionToken() {
                return posApi.fetchStripeConntectionToken();       
            };

            function unexpectedDisconnect() {
                console.log("Disconnected from reader")
            };

            function connectToReader() {
                posApi.readAppSettings().then((response) => {
                    stripeSettings = response.data.StripeConnection;
                    terminal = StripeTerminal.create({
                        onFetchConnectionToken: fetchConnectionToken,
                        onUnexpectedReaderDisconnect: unexpectedDisconnect,
                    });
    
                    var config = { simulated: false, location: stripeSettings.location };
                    
                    var discoverReadersPromise = terminal.discoverReaders(config);                 
                    $q.when(discoverReadersPromise)
                    .then((discoverResult) => {
                        if (discoverResult.error) {
                            console.log('Failed to discover: ', discoverResult.error);
                            window.localStorage.clear();
                        } else if (discoverResult.discoveredReaders.length === 0) {
                            console.log('No available readers.')
                            window.localStorage.clear();
                        } else {
                             //Selecting at position 0 because we have only one reader present
                             var discoveredReader = discoverResult.discoveredReaders[0];
                             var connectToReaderPromise =  terminal.connectReader(discoveredReader);
                             $q.when(connectToReaderPromise)
                             .then((connectResult) => {
                                if (connectResult.error) {
                                    console.log('Failed to connect: ', connectResult.error);
                                    window.localStorage.clear();
                                } else {
                                    console.log('Connected to reader: ', connectResult.reader.label);
                                    vm.changeState('payment');
                                }
                             })
                        }
                        
                    })              
                 })
                 .catch((error) => {
                     //TO-DO: Show error to user
                     console.log(error);
                 }); 
            };

            function reAuthentication() {
                var loginDate = JSON.parse(window.localStorage.getItem("loggedInToken"));
                var expiresIn = JSON.parse(window.localStorage.getItem("token")).expires_in;
                
                var expirationInEpoch = parseInt((loginDate + expiresIn));
                var now = new Date()  
                var nowInEpoch = Math.round(now.getTime() / 1000)

                if (nowInEpoch >= expirationInEpoch) {
                    posApi.readAppSettings()
                    .then((response) => {
                        authSettings = response.data.Auth0;                  
                        
                        var model = {
                            client_id: authSettings.client_id,
                            client_secret: authSettings.client_secret,
                            grant_type: authSettings.grant_type2,
                            refresh_token: JSON.parse(window.localStorage.getItem("refresh_token")),
                            audience: authSettings.audience,
                        };

                        posApi.reAuthenticate(model)
                        .then((authResponse) => {
                            logInTime = new Date(); 
                            logInToEpoch = Math.round(logInTime.getTime() / 1000);
                            window.localStorage.setItem("loggedInToken", logInToEpoch);
                            window.localStorage.setItem("token", JSON.stringify(authResponse.data));
                            connectToReader();
                        }).catch((error) => {
                            //TO-DO: Show error to user
                            console.log(error);
                        })

                    })
                    .catch((error) => {
                        window.localStorage.clear();
                        console.log(error);
                    });
                } else {
                    connectToReader();
                }
            }
        });

})();
