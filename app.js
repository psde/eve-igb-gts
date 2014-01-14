var $headers = {};
if (window.CCPEVE) {
    CCPEVE.requestTrust("http://localhost:23455");
} else {
  $headers = {"EVE_SOLARSYSTEMNAME": "VFK-IV", "EVE_SOLARSYSTEMID" : 30002904};
}

var module = angular.module('eve-igb',[]);
module.controller('RouteController', function($scope, $timeout, $http) {
    var current_system = 0;
    var destination = null;
    var autopilot_destination = null;

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

    function clearRoute() {
        destination = null;
        autopilot_destination = null;
        $scope.route = null;
        setDestination(0);
    }

    function requestRouteTo(destination) {
        $http.get('/api/gate-route/' + $scope.routeTo, {headers: $headers})
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

        var newAutopilotDest = route[destination - 1].id
        if(autopilot_destination != newAutopilotDest)
        {
            autopilot_destination = newAutopilotDest;
            setDestination(autopilot_destination);
        }

        $scope.route = route;

    }

    function setDestination(dest) {
        if (window.CCPEVE) {
            CCPEVE.setDestination(dest);
        }
        console.log("setDestination: " + dest)
    }

    function setMessage(msg) {
        $scope.message = msg;
    }

    function onSystemChanged(new_system) {
        current_system = new_system;
        if(destination) {
            requestRouteTo(destination);
        }
        console.log("onSystemChanged: " + current_system)
    }

    // This is needed because CCP sucks.
    function getCurrentSystem() {
        $http.get('/api/systemid/', {headers: $headers}).success(function(data) {
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