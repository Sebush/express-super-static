# express-super-static

## installation

edit package.json and add this to the dependencies-object

    "express-super-static": "git@github.com:Sebush/express-super-static.git",

## usage

    app.use(require('express-super-static')({
        dir: __dirname+'/public',
        maxAge: 300
    }));