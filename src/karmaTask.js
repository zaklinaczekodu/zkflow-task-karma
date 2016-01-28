'use strict';

var zkutils = require('gulp-zkflow-utils');
var karma = require('karma');
var istanbul = require('browserify-istanbul');
var watch = require('gulp-watch');
var q = require('q');
var karmaBrowserify = require('karma-browserify');
var karmaJasmine = require('karma-jasmine');
var karmaChromeLauncher = require('karma-chrome-launcher');
var karmaJunitReporter = require('karma-junit-reporter');
var karmaCoverage = require('karma-coverage');

function getKarmaTask(options, gulp, mode) {

  function karmaTask(next) {

    var logger = zkutils.logger('test');
    var nextHandler;

    var noTestFilesMessage =
      '\nNo test files found.\n\n' +
      'Your test files are determined by globs\n' +
      options.files.toString() + '\n\n' +
      'You can add some matching files with tests.\n' +
      'Learn more about ZKFlow testing toolstack:\n' +
      'http://karma-runner.github.io/0.13/index.html\n' +
      'http://jasmine.github.io/2.3/introduction.html\n' +
      'http://browserify.org/\n';

    var reporters = options.reporters;
    var transform = options.browserifyTransforms;
    var plugins = options.plugins.concat([
      karmaBrowserify,
      karmaJasmine,
      karmaChromeLauncher
    ]);

    if (!mode.watch) {
      reporters = reporters.concat(['junit', 'coverage']);
      transform = transform.concat([istanbul({
        ignore: options.istanbulIgnore
      })]);
      plugins.push(karmaJunitReporter);
      plugins.push(karmaCoverage);
    }

    function runKarma() {

      var karmaDeferred = q.defer();
      var server;

      server = new karma.Server({
        files: options.files,
        plugins: plugins,
        logLevel: options.logLevel,
        frameworks: options.frameworks,
        browserNoActivityTimeout: 120000,
        singleRun: !mode.watch,
        autoWatch: mode.watch,
        preprocessors: options.preprocessors,
        browserify: {
          debug: true,
          configure: function(bundle) {
            bundle.on('update', logger.changed);
          },
          transform: transform
        },
        browsers: options.browsers,
        reporters: reporters,
        junitReporter: {
          outputDir: options.reportsBaseDir + options.junitReporterOutputDir
        },
        coverageReporter: {
          dir: options.reportsBaseDir,
          reporters: options.istanbulReporters
        }
      }, function() {
        // without this empty function karma will stop execution of entire script after tests
      });

      server.on('run_complete', function(browsers, results) {

        var oldKarmaDeferred = karmaDeferred;

        karmaDeferred = q.defer();
        nextHandler.handle(karmaDeferred.promise);

        if (results.exitCode === 0) {
          oldKarmaDeferred.resolve();
          return;
        }

        oldKarmaDeferred.reject('failed');

      });

      server.start();

      return nextHandler.handle(karmaDeferred.promise);

    }

    nextHandler = new zkutils.NextHandler({
      next: next,
      watch: mode.watch,
      logger: logger
    });

    nextHandler.handle(
        zkutils.del(options.reportsBaseDir + '**')
        .then(zkutils.globby.bind(undefined, options.files, noTestFilesMessage)), {
          ignoreFailures: true,
          handleSuccess: false
        })
      .then(runKarma, function() {
        if (!mode.watch) {
          return;
        }
        var watchStream = watch(options.files, function(event) {
          watchStream.close();
          logger.changed(event);
          runKarma();
        });
      });

  }

  return karmaTask;

}

module.exports = {
  getTask: getKarmaTask,
  defaultOptions: {
    files: [
      'src/*Spec.js',
      'src/**/*Spec.js'
    ],
    logLevel: 'warn',
    frameworks: ['jasmine', 'browserify'],
    browserNoActivityTimeout: 120000,
    preprocessors: {
      'src/**': ['browserify']
    },
    browsers: ['Chrome'],
    reporters: ['progress'],
    plugins: [],
    reportsBaseDir: 'reports/test/',
    junitReporterOutputDir: 'junit/',
    htmlReporterOutputDir: 'html/',
    istanbulIgnore: [
      '**/node_modules/**',
      '**/bower_components/**',
      '*Spec.js',
      '**/*Spec.js'
    ],
    istanbulReporters: [{
      type: 'html',
      subdir: 'coverageHtml'
    }, {
      type: 'clover',
      subdir: 'coverageClover'
    }],
    browserifyTransforms: []
  }
};
