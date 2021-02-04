/*jshint esversion: 6 */
const path = require('path');
const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.json());

const bcrypt = require('bcrypt');

var fs = require('fs');

var multer  = require('multer');
var upload = multer({ dest: path.join(__dirname, './uploads')});

var Datastore = require('nedb')
  , users = new Datastore({ filename: path.join(__dirname,'db', './users.db'), autoload: true})
  , comments = new Datastore({ filename: path.join(__dirname,'db', './comments.db'), autoload: true, timestampData : true})
  , images = new Datastore({ filename: path.join(__dirname,'db', './images.db'), autoload: true, timestampData: true});

let Comment = function cmt(imageId, owner, content) {
    this.imageId = imageId;
    this.owner = owner;
    this.date = Date();
    this.content = content;
};

let Image = function img(title, owner, file) {
    this.title = title;
    this.owner = owner;
    this.date = Date();
    this.picture = file;
};

const cookie = require('cookie');

const session = require('express-session');
app.use(session({
    secret: 'please change this secret',
    resave: false,
    saveUninitialized: true,
}));

app.use(function (req, res, next){
    req.user = ('user' in req.session)? req.session.user : null;
    let username = (req.user)? req.user._id : '';
    res.setHeader('Set-Cookie', cookie.serialize('username', username, {
          path : '/', 
          maxAge: 60 * 60 * 24 * 7 // 1 week in number of seconds
    }));
    next();
});

app.use(function (req, res, next){
    console.log("HTTP request", req.username, req.method, req.url, req.body);
    next();
});

let isAuthenticated = function(req, res, next) {
    if (!req.user) return res.status(401).end(" You are not authenticated");
    next();
};

// Create

// Signs a user up
app.post('/signup/', function (req, res, next) {
    // extract data from HTTP request
    if (!('username' in req.body)) return res.status(400).end('username is missing');
    if (!('password' in req.body)) return res.status(400).end('password is missing');
    var username = req.body.username;
    var password = req.body.password;
    users.findOne({_id: username}, function(err, user){
        if (err) return res.status(500).end(err);
        if (user) return res.status(409).end(" Username " + username + " already exists");
        bcrypt.genSalt(10, function(err, salt) {
            if (err) return res.status(500).end(err);
            bcrypt.hash(password, salt, function(err, hash) {
                // insert new user into the database
                users.update({_id: username},{_id: username, hash: hash}, {upsert: true}, function(err){
                    if (err) return res.status(500).end(err);
                    req.session.user = user;
                    // initialize cookie
                    res.setHeader('Set-Cookie', cookie.serialize('username', username, {
                        path : '/',
                        maxAge: 60 * 60 * 24 * 7
                    }));
                    return res.json("user " + username + " signed up");
                });
            });
        });
    });
});

// Signs a user in
app.post('/signin/', function (req, res, next) {
    if (!('username' in req.body)) return res.status(400).end('username is missing');
    if (!('password' in req.body)) return res.status(400).end('password is missing');
    var username = req.body.username;
    var password = req.body.password;
    // retrieve user from the database
    users.findOne({_id: username}, function(err, user){
        if (err) return res.status(500).end(err);
        if (!user) return res.status(401).end(" Access denied, wrong username"); //wrong username
        bcrypt.compare(password, user.hash, function(err, valid) {
            if (err) return res.status(500).end(err);
            if (!valid) return res.status(401).end(" Access denied, wrong password"); //wrong password
            req.session.user = user;
            // initialize cookie
            res.setHeader('Set-Cookie', cookie.serialize('username', username, {
                path : '/',
                maxAge: 60 * 60 * 24 * 7
            }));
            return res.json("user " + username + " has been signed in");
        });
    });
});

// Post an image
app.post('/api/images/', isAuthenticated, upload.single('picture'), function (req, res, next) {
    // Check if the file being uploaded is of image type before adding to database
    let acceptedType = "image";
    if ((req.file.mimetype).includes(acceptedType) != true) {
        // remove the img file from the uploads directory
        fs.unlink('./uploads/' + req.file.filename, function(err){
            if (err) return console.log(err);
        });
        return res.status(415).end(" Uploaded file is not an image type");
    }

    if (req.query.owner !== req.user._id) return res.status(401).end(" You can only "
    + "modify your own gallery"); //wrong gallery owner
    let image = new Image(req.body.title, req.user._id, req.file);
    // insert new image into image database
    images.insert(image, function (err, img) {
        if (err) return res.status(500).end(err);
        return res.json(img);
    });
});

// Post a comment
app.post('/api/images/:id/comments/', isAuthenticated, function (req, res, next) {
    // Check to see if database is not empty (reduces chances of errors)
    images.count({owner: req.query.owner}, function (err, count) {
        if (count > 0) {
        images.findOne({_id: req.params.id}, function(err, image){
            if (err) return res.status(500).end(err);
            if (!image) return res.status(404).end(" Image id #" + req.params.id + " does not exist");
            let comment = new Comment(image._id, req.user._id, req.body.content);
            // Insert new comment into comment database
            comments.insert(comment, function (err, comment) {
                if (err) return res.status(500).end(err);
                return res.json(comment);
            });
        });
        } else {
            return res.status(404).end(" User " + req.query.owner + " has no images, can't comment");
        }
    });
});

// Read

// gets all users
app.get('/api/users/', function (req, res, next) {
    users.find({}).exec(function(err, data) { 
        if (err) return res.status(500).end(err);
        return res.json(data);
    });
});

// signs a user out
app.get('/signout/', function (req, res, next) {
    req.session.destroy();
    res.setHeader('Set-Cookie', cookie.serialize('username', '', {
          path : '/', 
          maxAge: 60 * 60 * 24 * 7 // 1 week in number of seconds
    }));
    res.redirect('/');
});

// Get 10 comments for a specific image
app.get('/api/images/:id/comments/', function (req, res, next) {
    // Check to see if database is not empty (reduces chances of errors)
    images.count({owner: req.query.owner}, function (err, count) {
        if (count > 0) {
        images.findOne({_id: req.params.id}, function(err, image){
            if (err) return res.status(500).end(err);
            if (!image) return res.status(404).end("No Image of such ID");
            // get 10 comments for the specified image by pagination
            comments.find({imageId : image._id}).sort({createdAt:-1}).skip(10*req.query.page).limit(10).exec(function(err, data) { 
                if (err) return res.status(500).end(err);
                return res.json(data.reverse());
            });
        });
        } else {
            return res.status(404).end(" User " + req.query.owner + " has no images, cant get comments");
        }
    });
});

// Gets all comments for a specific image
app.get('/api/images/:id/comments/all/', function (req, res, next) {
    console.log("all cmt post owner:"+req.query.owner);
    // Check to see if database is not empty (reduces chances of errors)
    images.count({owner: req.query.owner}, function (err, count) {
        if (count > 0) {
        images.findOne({_id: req.params.id}, function(err, image){
            if (err) return res.status(500).end(err);
            if (!image) return res.status(404).end("No Image of such ID:" + req.params.id);
            // Get every comment of the specified image from the database
            comments.find({imageId : image._id}).sort({createdAt:-1}).exec(function(err, data) { 
                if (err) return res.status(500).end(err);
                return res.json(data.reverse());
            });
        });
        } else {
            return res.status(404).end(" User " + req.query.owner + " has no images. Can't get comments");
        }
    });
});


// Gets all images with a specific owner in the database
app.get('/api/images/', function (req, res, next) {
    // console.log("this da owner:" + req.query.owner);
    images.find({owner:req.query.owner}).sort({createdAt:-1}).exec(function(err, data) { 
        if (err) return res.status(500).end(err);
        return res.json(data);
    });
});

// Get the image data
app.get('/api/images/:id/picture/', function (req, res, next) {
    // Get image from database
    images.findOne({_id: req.params.id}, function(err, image){
        if (err) return res.status(500).end(err);
        if (!image) return res.status(404).end("image id #" + req.params.id + " does not exist");
        // Decrypt picture data from binary and send back to front
        let pic = image.picture;
        res.setHeader('Content-Type', pic.mimetype);
        return res.sendFile(pic.path);
    });
});

// Delete

// Delete the image
app.delete('/api/images/:id/', isAuthenticated, function (req, res, next) {
    // get image
    images.findOne({_id: req.params.id}, function(err, image){
        if (err) return res.status(500).end(err);
        if (!image) return res.status(404).end("image id #" + req.params.id + " does not exist");
        if (image.owner !== req.user._id) return res.status(401).end(" Forbidden. only user " + image.owner + " can delete image");
        
        // remove the img file from the uploads directory
        fs.unlink('./uploads/' + image.picture.filename, function(err){
            if (err) return console.log(err);
        });

        // remove found image from database
        images.remove({ _id: req.params.id}, {}, function (err, numRemoved) {
            if (err) return res.status(500).end(err);
            // remove all comments of that image from database
            comments.remove({imageId: req.params.id}, { multi: true }, function (err, numRemoved) {
                if (err) return res.status(500).end(err);
            });
            return res.json(numRemoved);
        });
    });
});

// Delete a comment
app.delete('/api/images/:id/comments/:cmtId/', isAuthenticated,function (req, res, next) {
    // get image
    images.findOne({_id: req.params.id}, function(err, image){
        if (err) return res.status(500).end(err);
        if (!image) return res.status(404).end("image id #" + req.params.id + " does not exist");

        // get comment
        comments.findOne({_id: req.params.cmtId}, function(err, comment) {
            if (err) return res.status(500).end(err);
            if (!comment) return res.status(404).end("comment id #" + req.params.cmtId + " does not exist");
            if (comment.owner !== req.user._id && image.owner !== req.user._id) return res.status(401).end(" Forbidden. only user " + comment.owner + " or gallery owner can delete comment");
            // delete obtained comment from database
            comments.remove({_id: req.params.cmtId}, {}, function (err, numRemoved) {
                if (err) return res.status(500).end(err);	
                return res.json(numRemoved);
            });
        });
    });
});

app.use(express.static('static'));
const http = require('http');
const PORT = 3000;

http.createServer(app).listen(PORT, function (err) {
    if (err) console.log(err);
    else console.log("HTTP server on http://localhost:%s", PORT);
});