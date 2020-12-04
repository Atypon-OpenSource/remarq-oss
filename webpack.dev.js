'use strict';
const path = require('path');
const webpack = require('webpack');
const Merge = require('webpack-merge');
const CommonConfig = require('./webpack.common');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const {BundleAnalyzerPlugin} = require('webpack-bundle-analyzer');
const ClosureCompilerPlugin = require('webpack-closure-compiler');

module.exports = function (env) {
    env.dev_mode = true;

    const closure = !!env.closure && JSON.parse(env.closure);
    const analyze = !!env.analyze && JSON.parse(env.analyze);
    console.log(`closure=${closure} analyze=${analyze}`);

    const plugins = [
        new webpack.DefinePlugin({
            'process.env': {
                'NODE_ENV': JSON.stringify('dev')
            }
        }),
        new CopyWebpackPlugin ([
            // {context: 'src/web', from: '*.*', to: 'web/'},
            {context: 'src/', from: '*.html'},
            {context: 'src/web/', from: '*.html', to: 'web/'},
            {context: 'src/pdfFrame', from: '*.html', to: 'pdfFrame/'},
            {context: 'src/tour', from: '*.html', to: 'tour/'}
        ])
    ];

    if (closure){
        plugins.push(new ClosureCompilerPlugin({
            compiler: {
                language_in: 'ECMASCRIPT5',
                language_out: 'ECMASCRIPT5',
                // compilation_level: 'ADVANCED'
                compilation_level: 'SIMPLE',
                create_source_map: true,
                warning_level: 'QUIET',
                "rmq:strip_logs":false,
                jar: path.resolve(__dirname, 'closure_compiler/target/closure-compiler-0.0.1-jar-with-dependencies.jar')
            },
            concurrency: 3,
            exclude: [
                /vendor/,
                /jquery/,
                /xlsx/,
                /prosemirror/i
            ]
        }));
    }

    if (analyze){
        plugins.push(new BundleAnalyzerPlugin({
            "analyzerMode":"static"
        }));
    }

    return Merge(CommonConfig(env), {
        output: {
            filename: '[name].bundle.js',
            chunkFilename: '[name].bundle.js',
            path: path.resolve(__dirname, 'dist'),
            publicPath: '/dist/'
        },
        devtool: "source-map",
        devServer: {
            compress: true,
            contentBase: [
                path.join(__dirname, "src/"),
                path.join(__dirname, ".")
            ],
            https: {
                spdy: {
                    protocols: ['http/1.1'],
                }
            },
            overlay: true,
            port: 9443,
            proxy: {
                "/api": {
                    target: "http://localhost:9090",
                    secure: false
                },
                "/sockjs-node": {
                    target: "ws://localhost:9090",
                    secure: false,
                    ws: true
                }
            }
        },
        plugins: plugins
    });
};