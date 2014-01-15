var headers = {};
if (window.CCPEVE) {
    CCPEVE.requestTrust("http://localhost:23455");
} else {
  headers = {"EVE_SOLARSYSTEMNAME": "VFK-IV", "EVE_SOLARSYSTEMID" : 30002904};
}

var module = angular.module('eve-igb',[]);
module.service('EveIgbService', function($http, $timeout) {
    var autopilot_destination = null;

    this.setAutopilotDestination = function(dest) {
        if(autopilot_destination != dest) {
            autopilot_destination = dest;
            setCCPEVEDestination(autopilot_destination);
        }
        console.log("setAutopilotDestination: " + dest)
    }    

    this.clearAutopilotDestination = function() {
        autopilot_destination = null;
        setCCPEVEDestination(0);
        console.log("clearAutopilotDestination")
    }

    var onSystemChangedListener = [];
    this.addOnSystemChangedListener = function(func) {
        onSystemChangedListener.push(func);
    }

    function setCCPEVEDestination(dest) {
        if (window.CCPEVE) {
            CCPEVE.setDestination(dest);
        }
    }

    var current_system = 0;
    function onSystemChanged(new_system) {
        current_system = new_system;
        if(destination) {
            for(var i in onSystemChanged) {
                onSystemChangedListener[i](current_system);
            }
        }
        console.log("onSystemChanged: " + current_system)
    }

    // This is needed because CCP sucks.
    function getCurrentSystem() {
        $http.get('/api/systemid/', {headers: headers}).success(function(data) {
            var new_system = data.id
            if(current_system != new_system)
            {
                onSystemChanged(new_system);
            }
        });

        $timeout(function() {
            getCurrentSystem();
        }, 5000);
    }
    getCurrentSystem();
});

module.controller('RouteController', function($scope, $timeout, $http, EveIgbService) {
    var destination = null;

    //$scope.routeTo = "1dh";

    // Buttons
    $scope.findRoute = function() {
        destination = $scope.routeTo;
        requestRouteTo(destination);
    };

    $scope.clearRoute = function() {
        clearRoute();
        setMessage("");
    };

    function requestRouteTo(destination) {
        $http.get('/api/gate-route/' + $scope.routeTo, {headers: headers})
            .success(function(data) {
                setMessage("");
                setRoute(data.route);
            })
            .error(function(data) {
                // No route found?
                if(data == null || data.route == null || data.route.length == 0)
                {
                    clearRoute();
                    setMessage("No route found.");
                    return;
                }
            });
    }

    function setRoute(route) {
        // Are we there yet?
        if(route.length == 1 && current_system == route[0].id) {
            clearRoute();
            setMessage("Destination reached");
            return;
        }

        // Determine next destination
        var destination = route.length - 1;
        for (var i = 0; i < route.length; i++) {
            element = route[i];

            if(element.type == "Bridge") {
                destination = i;
                break;
            }
        }
        route[destination].destination = true;

        EveIgbService.setAutopilotDestination(route[destination - 1].id);
        $scope.route = route;
    }

    EveIgbService.addOnSystemChangedListener(function (sys) {
        if(destination) {
            requestRouteTo(destination);
        }
    });

    function clearRoute() {
        destination = null;
        $scope.route = null;
        EveIgbService.clearAutopilotDestination();
    }

    function setMessage(msg) {
        $scope.message = msg;
    }
});