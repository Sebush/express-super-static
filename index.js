var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var mime = require('mime');
var zlib = require('zlib');

/*
 * Middleware
 */
var cache = {
    raw: {},
    gzip: {},
    deflate: {},
};
var _files = [];

module.exports = function(options){
    options = _.extend({
        dir: 'views',
        maxAge: 0,
        chunked: false,
        cache: ['js', 'css', 'txt', 'ejs', 'html', 'xml', 'json', 'map', 'svg', 'jpg', 'gif', 'ico', 'png', 'woff', 'woff2', 'otf', 'ttf'],
        compress: ['js', 'css', 'txt', 'ejs', 'html', 'xml', 'json', 'map'],
        download: false
    }, options);
    filesFromDirToDictCache(options, cache);
    return function(req, res, next){
        if(_files.indexOf(req.url) == -1){
            return next();
        }
        var type = 'raw';  // type: gzip, deflate, raw
        var compressable = false;
        var acceptEncodingHeader = req.headers['accept-encoding'];
        if(acceptEncodingHeader){
            var ext = req.url.split('.').pop();
            compressable = options.compress.indexOf(ext) > -1;
            if(compressable){
                if(acceptEncodingHeader.match(/\bgzip\b/)){
                    type = 'gzip';
                }else if(acceptEncodingHeader.match(/\bdeflate\b/)){
                    type = 'deflate';
                }
            }
        }
        var item = cache[type][req.url];
        if(item){
            if (req.headers['if-none-match'] && req.headers['if-none-match'] === item.headers.ETag) {
                // res.header('etag', item.headers.etag);
                // res.header('last-modified', item.headers['last-modified']);
                return res.status(304).end();
            }else{
                if(compressable){
                    res.header('Vary', 'Accept-Encoding');
                }
                if(options.maxAge){
                    res.header('Cache-Control', 'public, max-age=' + options.maxAge);
                }
                res.header('Content-Type', item.headers['Content-Type']);
                if(!options.chunked){
                    res.header('Content-Length', item.content.length);
                }
                if(options.download){
                    var file_name = req.url.split('/').pop();
                    header['Content-Disposition'] = 'attachment; filename='+file_name;
                    res.writeHead(200, headers);
                    res.pipe(item.content);
                }else{
                    res.writeHead(200, item.headers);
                    return res.end(item.content);
                }
            }
        }else{
            next();
        }
    };
};

var filesFromDirToDictCache = function(options, cache, startidx) {
    startidx = startidx || options.dir.length;
    var files = fs.readdirSync(options.dir);
    files.forEach(function(file) {
        var fullPath = path.join(options.dir, file);
        var f = fs.statSync(fullPath);
        if (f.isDirectory()) {
            filesFromDirToDictCache({dir: fullPath, cache: options.cache, compress: options.compress}, cache, startidx);
        } else {
            var fullPathArr = fullPath.split('.');
            var ext = null;
            if(fullPathArr.length > 1){
                ext = fullPathArr[fullPathArr.length-1];
                if(options.cache.indexOf(ext) > -1){
                    var key = fullPath.substr(startidx);

                    _files.push(key);

                    var headers = {
                        'ETag': f.size + '-' + Date.parse(f.mtime),
                        'Last-Modified': f.mtime,
                        'Content-Type': mime.lookup(fullPath)
                    };

                    cache.raw[key] = {
                        content: fs.readFileSync(fullPath),
                        headers: headers
                    };

                    console.info('Cache-Static: (views)%s', key, ext);  // (views)/js/pace.min.js js
                    if(options.compress.indexOf(ext) > -1){

                        ['gzip', 'deflate'].forEach(function(typ){
                            zlib[typ](new Buffer(cache.raw[key].content, 'utf-8'), function (err, result) {
                                headers['Content-Encoding'] = typ;
                                cache[typ][key] = {
                                    content: result,
                                    headers: _.extend({}, headers)
                                };
                                console.info('Cache-Static: [%s] (views)%s', typ, key);
                            });
                        });

                    }
                }
            }
        }
    });
};