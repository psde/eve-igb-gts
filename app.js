var headers = {};
if (window.CCPEVE) {
    CCPEVE.requestTrust("http://localhost:23455");
} else {
  headers = {"EVE_SOLARSYSTEMNAME": "VFK-IV", "EVE_SOLARSYSTEMID" : 30002904};
}

var module = angular.module('eve-igb',[]);
module.service('EveIgbService', function($http, $timeout, $rootScope) {
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

    this.setMessage = function(msg) {
        $rootScope.message = msg;
    }

    this.getCurrentSystem = function(){
        return current_system;
    }

    function setCCPEVEDestination(dest) {
        if (window.CCPEVE) {
            CCPEVE.setDestination(dest);
        }
    }

    var current_system = 0;
    function onSystemChanged(new_system) {
        current_system = new_system;
        console.log("onSystemChanged: " + current_system)
    }

    // This is needed because CCP sucks.
    function getCurrentSystem() {
        $http.get('/api/info/', {headers: headers}).success(function(data) {
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
    $scope.current_system = 0;
    $scope.route = [];

    var destination = null;

    //$scope.routeTo = "1dh";

    // Buttons
    $scope.findRoute = function() {
        destination = $scope.routeTo;
        requestRouteTo(destination);
    };

    $scope.importRoute = function() {
        destination = null;
        importRoute();
    };

    $scope.clearRoute = function() {
        clearRoute();
        EveIgbService.setMessage("");
    };

    function requestRouteTo(destination) {
        console.log("requestRouteTo:" + destination)
        requestRouteUrl('/api/gate-route/' + $scope.routeTo);
    }

    function importRoute() {
        console.log("importRoute")
        requestRouteUrl('/api/gts-route/');
    }

    function requestRouteUrl(url) {
        $http.get(url, {headers: headers})
            .success(function(data) {
                EveIgbService.setMessage("");
                setRoute(data);
            })
            .error(function(data) {
                // No route found?
                if(data == null || data.route == null || data.route.length == 0)
                {
                    clearRoute();
                    EveIgbService.setMessage("No route found.");
                    return;
                }
            });
    }

    function setRoute(data) {
        var route = data.route;
        var isJumpRoute = data.isJumpRoute == "True";

        // Are we there yet?
        if(route.length == 1 && current_system == route[0].id) {
            clearRoute();
            EveIgbService.setMessage("Destination reached");
            return;
        }

        $scope.route = route;
        $scope.fuelcost = data.fuel;

        setNextDestination();
    }

    function setNextDestination() {
        var route = $scope.route;
        if(destination != null) {
            // Determine next destination
            var dest = route.length - 1;
            for (var i = 0; i < route.length; i++) {
                element = route[i];

                if(element.type != "Gate") {
                    dest = i;
                    break;
                }
            }
            route[dest].destination = true;

            EveIgbService.setAutopilotDestination(route[dest - 1].id);
        } else if(route.length > 0){
            // Imported route, check if current system on route and set next destination
            var currenySystemIndex = -1;
            for (var i = 0; i < route.length; i++) { 
                route[i].destination = false;
                if(route[i].id == EveIgbService.getCurrentSystem()) {
                    currenySystemIndex = i;
                }
            }

            if(currenySystemIndex == -1)
            {
                route[0].destination = true;
                EveIgbService.setAutopilotDestination(route[0].id);
            }else{
                var dest = route.length - 1;
                for (var i = currenySystemIndex; i < route.length; i++) {
                    element = route[i];

                    if(element.type != "Gate") {
                        dest = i;
                        break;
                    }
                }
                route[dest].destination = true;
                EveIgbService.setAutopilotDestination(route[dest - 1].id);
            }
        }
        $scope.route = route;
    }

    $scope.$watch(EveIgbService.getCurrentSystem, function (sys) {
        $scope.current_system = sys;
        if(destination != null) {
            // Reroute player
            requestRouteTo(destination);
        } else {
            setNextDestination();
        }
    });

    function clearRoute() {
        destination = null;
        $scope.route = null;
        $scope.fuelcost = 0;
        EveIgbService.clearAutopilotDestination();
        console.log("clearRoute()")
    }
});