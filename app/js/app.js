'use strict';

var hnBrowser = angular.module('hnBrowser', ['firebase', 'hnBrowserControllers']),
    hnBrowserControllers = angular.module('hnBrowserControllers', []);

hnBrowserControllers.controller('StoryListCtrl', ['$scope', '$firebaseArray', function ($scope, $firebaseArray) {
    var url = 'https://hacker-news.firebaseio.com/v0',
        fireRef = new Firebase(url);

    // https://hacker-news.firebaseio.com/v0/topstories.json
    // https://hacker-news.firebaseio.com/v0/item/XXXX.json

    $scope.topstories = $firebaseArray(fireRef.child('topstories'));
}]);
