/*jshint esversion: 6 */
(function(){
	"use strict";
	
	window.onload = (function(){

		// Default img if no image is uploaded
		document.getElementById("curr_img").innerHTML = `
		<img class="img" src="./media/no-img.jpg">
		`;

		api.onUsernameUpdate(function(username){
            document.querySelector("#signin_button").style.visibility = (username)? 'hidden' : 'visible';
            document.querySelector("#signout_button").style.visibility = (username)? 'visible' : 'hidden';
			document.getElementById("main_page").style.visibility = (username)? 'visible' : 'hidden';
			document.getElementById("welcome_message").innerHTML = (username)? `Welcome ` + username + `!!` : `Please login or signup`;
    	});

		// hide image navigation buttons and comment section if there is no image
		document.getElementById("img_nav_butons").style.display = "none";
		document.getElementById("comment_section").style.display = "none";

    	document.getElementById("create_comment_form").addEventListener('submit', function(e){
    		// prevent from refreshing the page on submit
    		e.preventDefault();
    		// read form elements
    		let content = document.getElementById("comment_content").value;
		
			// add comment based on data given
    		api.addComment(api.getMainId(), content);
		
    		// clean comment form
    		document.getElementById("create_comment_form").reset();
		});

		document.getElementById("post_username").addEventListener("change", function(e){
			let username = document.getElementById("post_username").value;
			// change the current user
			api.setCurrUser(username, function(){
				console.log("user changed to " + username);
				api.notifyImageListeners();
			});
		});
		
		document.getElementById("prev_img").addEventListener('click', function(e){
			// Move to the previous image
			api.setPointer(-1, function(){
				api.notifyImageListeners();
			});
		});
	
		document.getElementById("next_img").addEventListener('click', function(e){
			// Move to the next image
			api.setPointer(1, function(){
				api.notifyImageListeners();
			});
		});

		document.getElementById("del_img").addEventListener('click', function(e){
			// Delete current image
			var imgId = api.getMainId();
			api.deleteImage(imgId);
		});
	
		document.getElementById("submit_img_form").addEventListener('submit', function(e){
			// prevent from refreshing the page on submit
			e.preventDefault();
		
			// read from elements
			let title = document.getElementById("img_title").value;
			let file = document.getElementById("img_file").files[0];
		
			// Add image based on given elements
			api.addImage(title, file);
		
			// clean img submission form
    		document.getElementById("submit_img_form").reset();
		});
	
		document.getElementById("show_btn").addEventListener('click', function(e){
			// Get the element and toggle it based on if statement
			// Code snippet taken from https://www.w3schools.com/howto/howto_js_toggle_hide_show.asp
			var x = document.getElementById("submit_img_form");
			if (x.style.display === "none") { 
				x.style.display = "flex";
			} else {
				x.style.display = "none";
			}
		});
	
		document.getElementById("next_cmt_page").addEventListener('click', function(e){
		 	// Move to the next page of 10 comments
			 api.setPage(1, function(){
				api.notifyCommentListeners();
			});
		});
	
		document.getElementById("prev_cmt_page").addEventListener('click', function(e){
			// Move to the previous page of 10 comments
			api.setPage(-1, function(){
				api.notifyCommentListeners();
			});
		});
	
	});

	api.onError(function(err){
        console.error("[error]", err);
	});
	
	api.onError(function(err){
		var error_box = document.querySelector('#error_box');
		error_box.innerHTML = err;
		error_box.style.visibility = "visible";
	});
	
    api.onImageUpdate(function(images){
		// Get current image based on the pointer
		let index = api.getPointer();
		if (index >= images.length && images.length > 0) api.setPointer(-index, function(){}, index-1);
		let curr_img = images[api.getPointer()];
		//console.log("index:" + index + ", images:" + images + ", length:" + images.length);

		// reset innerHTML
		document.getElementById("curr_img").innerHTML = '';
		// Case for when there are images
		if (curr_img != undefined) {
			// show image navigation buttons and comment section for the image
			document.getElementById("img_nav_butons").style.display = "flex";
			document.getElementById("comment_section").style.display = "flex";
			
			// Set the new current image on the image container
			document.getElementById("curr_img").innerHTML = `
						<div class="img_title">${curr_img.title} by ${curr_img.owner}</div>
						<img class="img" src="/api/images/${curr_img._id}/picture/">
			`;
			// set the id of what the user is viewing to this
			api.setMainId(curr_img._id);
			console.log("updating comments");
			// Update the comment section based on the current image's comment data
			api.notifyCommentListeners();
		}
		// Case for whenever there are no images
		else {
			// Default img if no image is uploaded
			document.getElementById("curr_img").innerHTML = `
					<img class="img" src="./media/no-img.jpg">
			`;
			
			// hide image navigation buttons and comment section if there is no image
			document.getElementById("img_nav_butons").style.display = "none";
			document.getElementById("comment_section").style.display = "none";
		}
	});
	
    api.onCommentUpdate(function(comments){	
		console.log("comments:" + comments);
		// Reset innerHTML for comments before updating
        document.getElementById("comments").innerHTML = '';
		// Update each comment, from most recent posted order
        comments.forEach(function(comment){
            let elmt = document.createElement('div');
			elmt.className = "comment_container";
			elmt.id = "cmt" + comment._id;
            elmt.innerHTML = `
					<div class="comment_author">${comment.owner}</div>
					<div class="comment_seperator"></div>
					<div class="content">${comment.content}</div>
					<div class="comment_container_accesories">
						<div class="comment_accesories">${comment.date}</div>
						<button type="submit" class="cmt_btn">X</button>
					</div>
                `;  
            elmt.querySelector('.comment_container_accesories .cmt_btn').addEventListener('click', function(e){
				// Delete comment based on its comment id
                api.deleteComment(comment._id);
            });
			
            document.getElementById("comments").prepend(elmt);
		});
		console.log("finished updating comments!!");
	});
	
	api.onUsersUpdate(function(users){
        document.getElementById("post_username").innerHTML = "";
        if (users.length === 0) {}//document.querySelector("#welcome_message").classList.remove('hidden');
        else {
            //document.querySelector("#main_page").classList.remove('hidden');
            users.forEach(function(user){
                var elmt = document.createElement('option');
                elmt.value = user._id;
                elmt.innerHTML = user._id;
                document.getElementById("post_username").prepend(elmt);
			});
			if (users.length === 1) {
				api.setCurrUser(users[0]._id, function(){
				api.notifyImageListeners();
			});
			}
        };
    });
	
}())
