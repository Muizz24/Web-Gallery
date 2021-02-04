/*jshint esversion: 6 */
var api = (function(){
    "use strict";
    var module = {};

    if (!localStorage.getItem('items')){
        localStorage.setItem('items', JSON.stringify({curr_pointer: 0, curr_id: 0, max: 0,
                                                      curr_page: 0, last_page: 0, curr_user: ""}));
    }

    function sendFiles(method, url, data, callback){
        let formdata = new FormData();
        Object.keys(data).forEach(function(key){
            let value = data[key];
            formdata.append(key, value);
        });
        let xhr = new XMLHttpRequest();
        xhr.onload = function() {
            if (xhr.status !== 200) callback("[" + xhr.status + "]" + xhr.responseText, null);
            else callback(null, JSON.parse(xhr.responseText));
        };
        xhr.open(method, url, true);
        xhr.send(formdata);
    }

    function send(method, url, data, callback){
        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
            if (xhr.status !== 200) callback("[" + xhr.status + "]" + xhr.responseText, null);
            else callback(null, JSON.parse(xhr.responseText));
        };
        xhr.open(method, url, true);
        if (!data) xhr.send();
        else{
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(data));
        }
    }
    
    /*  ******* Data types *******
        image objects must have at least the following attributes:
            - (String) _id 
            - (String) title
            - (String) author
            - (Date) date
    
        comment objects must have the following attributes
            - (String) _id
            - (String) imageId
            - (String) author
            - (String) content
            - (Date) date
    
    ****************************** */ 
    
    let usernameListeners = [], usersListeners = [];
    
    // get the username of the current user
    let getUsername = function(){
        var username = document.cookie.split("username=")[1];
        if (username.length == 0) return null;
        return username;
    }

    // get all users
    let getUsers = function(callback){
        send("GET", "/api/users/", null, callback);
    }

    // notify a user
    function notifyUsernameListeners(username){
        usernameListeners.forEach(function(listener){
            listener(username);
        });
    };

    // notify all users
    function notifyUsersListeners(){
        usersListeners.forEach(function(listener){
            listener([]);
        });
    };

    // when a user is updated
    module.onUsernameUpdate = function(listener){
        usernameListeners.push(listener);
        listener(getUsername());
    }

    module.onUsersUpdate = function(listener){
        usersListeners.push(listener);
        getUsers(function(err, users){
            if (err) return notifyErrorListeners(err);
            listener(users);
        });
    }

    // user signs up
    module.signup = function(username, password){
        send("POST", "/signup/", {username, password}, function(err, res){
            if (err) return api.notifyErrorListeners(err);
            notifyUsernameListeners(getUsername());
        });
    }

    // user signs in
    module.signin = function(username, password){
        send("POST", "/signin/", {username, password}, function(err, res){
            if (err) return api.notifyErrorListeners(err);
            notifyUsernameListeners(getUsername());
       });
    }

    // // user signs out
    // module.signout = function(){
        
    // }

    // add an image to the gallery
    module.addImage = function(title, file){
        sendFiles("POST", "/api/images/?owner=" + api.getCurrUser(), {title: title, picture: file}, function(err, res){
            if (err) return api.notifyErrorListeners(err);
            api.notifyImageListeners();
       });
    }
    
    // delete an image from the gallery given its imageId
    module.deleteImage = function(imageId){
        send("DELETE", "/api/images/" + imageId + "/", null, function(err, res){
            if (err) return api.notifyErrorListeners(err);
            api.notifyImageListeners();
       });
    }
    
    // add a comment to an image
    module.addComment = function(imageId, content){
        send("POST", "/api/images/" + imageId + "/comments/?owner=" + api.getCurrUser(), {imageId: imageId,
                content: content}, function(err, res){
            if (err) return api.notifyErrorListeners(err);
            api.notifyCommentListeners();
       });
    }
    
    // delete a comment to an image
    module.deleteComment = function(commentId){
        send("DELETE", "/api/images/" + api.getMainId() + "/comments/" + commentId + "/", 
                null, function(err, res) {
            if (err) return api.notifyErrorListeners(err);
            api.notifyCommentListeners();
       });
    }

    // gets 10 comments from the database by pagination
    module.getComments = function(page, callback){
        send("GET", "/api/images/" + api.getMainId() + "/comments/?page=" + page + 
        "&owner=" + (api.getCurrUser()), {currpage: page}, callback);
    }

    // gets every comment from the database for a specified image 
    module.getAllComments = function(callback){
        send("GET", "/api/images/" + api.getMainId() + "/comments/all/?owner=" + api.getCurrUser(), null, callback);
    }

    // gets all images from the database
    module.getImages = function(owner, callback){
        send("GET", "/api/images/?owner=" + owner, null, callback);
    }
    
    let commentListeners = [], imageListeners = [], errorListeners = [];
    
    // notify all comment listeners
    module.notifyCommentListeners = function(){
		api.getComments(api.getPage(), function(err, comments){
            if (err) return api.notifyErrorListeners(err);
            commentListeners.forEach(function(listener){
                listener(comments);
            });
        });
    }

    // notify all image listeners
	module.notifyImageListeners = function() {
		api.getImages((api.getCurrUser()),function(err, images){
            if (err) return api.notifyErrorListeners(err);
            imageListeners.forEach(function(listener){
                listener(images);
            });
        });
	}

    // notify all error listeners
    module.notifyErrorListeners = function(err){
        errorListeners.forEach(function(listener){
            listener(err);
        });
    }

    // call handler when an image is added or deleted from the gallery
    module.onImageUpdate = function(handler){
        imageListeners.push(handler);
        api.getImages(api.getCurrUser(),function(err, images){
            if (err) return api.notifyErrorListeners(err);
            handler(images);
        });
    }
    
    // call handler when a comment is added or deleted to an image
    module.onCommentUpdate = function(handler){
        commentListeners.push(handler);
        api.getComments(api.getPage(), function(err, comments){
            if (err) return api.notifyErrorListeners(err);
            handler(comments);
        });
    }

    // call handler when an error is produced
    module.onError = function(listener){
        errorListeners.push(listener);
    };

    // gets the index thats currently viewing the specified image in the database list
    module.getPointer = function(){
        let items = JSON.parse(localStorage.getItem('items'));
        return items.curr_pointer;
    };

    // update the pointer to point to a new image
    module.setPointer = function(value, callback, max=0){
        let items = JSON.parse(localStorage.getItem('items'));
        // modify the pointer to a new value
        items.curr_pointer = items.curr_pointer + value;
        if (max != 0) items.max = max;
        if (items.curr_pointer < 0) items.curr_pointer=items.max;
        items.curr_page=0, items.last_page=0;
        // store new value locally since its what the user is seeing
        localStorage.setItem('items', JSON.stringify(items));
        return callback();
    };

    // update the page to a new page
    module.setPage = function(value, callback){
        // get every comment for the image being viewed by the user currently
        api.getAllComments(function(err, comments){
            let items = JSON.parse(localStorage.getItem('items'));
            // modify the value of current page to the new page the user wants to see
            items.curr_page = Math.max(0, items.curr_page + value);
            items.last_page = Math.floor(comments.length/10);
            if (items.curr_page >= items.last_page) items.curr_page = items.last_page;
            // store new page value locally since its what the user is looking at
            localStorage.setItem('items', JSON.stringify(items));
            return callback();
        })
    };

    // get the comment page the user is viewing right now
    module.getPage = function(){
        let items = JSON.parse(localStorage.getItem('items'));
        return items.curr_page;
    };

    // Set the image id of the image the user is currently viewing
    module.setMainId = function(id){
        let items = JSON.parse(localStorage.getItem('items'));
        items.curr_id = id;
        localStorage.setItem('items', JSON.stringify(items));
    };

    // get the image id of the image the user is viewing
    module.getMainId = function(){
        let items = JSON.parse(localStorage.getItem('items'));
        return items.curr_id;
    };

    // Set the current user of which the logged in user is currently viewing their gallery
    module.setCurrUser = function(username, callback){
        let items = JSON.parse(localStorage.getItem('items'));
        // set the username and reset all other pointers
        items.curr_user = username;
        items.curr_id = 0;
        items.curr_pointer = 0;
        items.curr_page = 0;
        items.max = 0;
        items.last_page = 0;
        localStorage.setItem('items', JSON.stringify(items));
        return callback();
    };

    // get the current user that the logged in user is looking at their gallery of
    module.getCurrUser = function(){
        let items = JSON.parse(localStorage.getItem('items'));
        return items.curr_user;
    };

    (function refresh(){
        setTimeout(function(e){
            api.notifyImageListeners();
            refresh();
        }, 2000);
    }());
       
    
    return module;
})();