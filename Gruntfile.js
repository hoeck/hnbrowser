module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        sass: {
            options: {
                trace: true
            },
            dist: {
                files: {
                    "dist/css/app.css": "src/scss/app.scss"
                }
            }
        },
        copy: {
            dist: {
                files: {
                    "dist/index.html": "src/index.html",
                    "dist/js/app.js": "src/js/app.js"
                }
            }
        },
        connect: {
            dev: {
                options: {
                    livereload: true,
                    port: 8000,
                    hostname: '127.0.0.1',
                    base: 'dist'
                }
            }
        },
        watch: {
            options: {
                livereload: true,
                livereloadOnError: false
            },
            sass: {
                files: ['src/scss/*.scss'],
                tasks: ['sass']
            },
            dist: {
                files: ['src/**/*.js', 'src/*.html'],
                tasks: ['copy']
            }
        },
        clean: ['dist']
    });

    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-connect');

    grunt.registerTask('dev', ['sass', 'copy', 'connect', 'watch']);
    grunt.registerTask('deploy', ['sass', 'copy']);
    grunt.registerTask('default', 'deploy');
};
