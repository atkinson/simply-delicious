SimplyDelicious = {
    prefs: {},
    defaults: {
	username: '',
	password: '',
        newtab: 'on',
        copylocal: 'on',
        tags: 'desc',
        schedule: '3600',
	ts: '000000'
    },
    store: function(callback){
	SimplyDelicious.prefs.ts = new Date().getTime();
        localStorage['prefs'] = JSON.stringify(SimplyDelicious.prefs);
	console.log('preferences saved');
        callback && callback();
    },
    load: function(callback){
	var data = localStorage['prefs'] || JSON.stringify(SimplyDelicious.defaults);
        SimplyDelicious.prefs = JSON.parse(data);
        callback && callback();
    },
    populate: function(callback){
        $("#username").val(SimplyDelicious.prefs.username);
        $("#password").val(SimplyDelicious.prefs.password);
        $("#newtab").attr('checked', SimplyDelicious.prefs.newtab);
        $("#copylocal").attr('checked', SimplyDelicious.prefs.copylocal);
	var tagSelector = "input[value=" + SimplyDelicious.prefs.tags + "]";
        $(tagSelector).attr('checked', true);
	var schedSelector = "input[value=" + SimplyDelicious.prefs.schedule + "]";
        $(schedSelector).attr('checked', true);
        callback && callback();
    },
    savechanges: function(callback){
        SimplyDelicious.prefs.username = $("#username").val();
        SimplyDelicious.prefs.password = $("#password").val();
        SimplyDelicious.prefs.newtab = $("#newtab").attr('checked');
        SimplyDelicious.prefs.copylocal = $("#copylocal").attr('checked');
        SimplyDelicious.prefs.tags = $("input[name='tags']:checked").val();
        SimplyDelicious.prefs.schedule = $("input[name='schedule']:checked").val();
        SimplyDelicious.store(callback);
    },
    factoryreset: function(callback){
	SimplyDelicious.prefs = SimplyDelicious.defaults;
	SimplyDelicious.populate(callback);
    },
}

Chromium = {
    folderName: 'Simply Delicious',
    folderID: function(){return localStorage["folderID"]},
    _BOOKMARK_BAR: '1',
    _OTHER_BOOKMARKS: '2',

    _createFolder: function(callback){
	    localStorage["folderID"] = undefined;
	    chrome.bookmarks.create({'parentId':Chromium._OTHER_BOOKMARKS, 'title':Chromium.folderName}, function(newFolder){
		localStorage["folderID"] = newFolder.id;
	    });
	    setTimeout("callback && callback()",250); // very dirty hack - Stupid chrome.bookmarks.create doesn't pass callbacks along
	    	    
    },
    init: function(callback){
	    if(Chromium.folderID()) {
		try {
		    chrome.bookmarks.get(Chromium.folderID(), function(results){
			if(results && results.length && results[0].title == Chromium.folderName) {
			    console.log('found folder: '+ results[0].title);
			} else {
			    Chromium._createFolder();
			};
		    });
		    callback && callback();
		} catch(e) {
		  console.log(e);
		  Chromium._createFolder(callback);
		};
	    } else {
		Chromium._createFolder(callback);
	    };
    },
    sync: function(){
	for (var i = 0; i < Delicious.posts.length; i++) {
	    var url = Delicious.posts[i].href;
	    var title = Delicious.posts[i].description;
	    var tags = Delicious.posts[i].tag;
	    Chromium.insert(url, title, tags);
	};
	console.log('Delicious sync complete');
    },
    insert: function(url, title, tags){
	var label = title + ' (' + tags + ')';
	chrome.bookmarks.search(url, function(results){
	    if(results.length == 0) chrome.bookmarks.create({'parentId':Chromium.folderID(), 'title':label, 'url':url});
	});
    }
}

Delicious = {
    user: 'rich.atkinson',
    posts: [],
    add: function(tab){
      chrome.tabs.getSelected(null, function(tab){
	  var url = 'http://delicious.com/save?url='+encodeURIComponent(tab.url)+'&title='+encodeURIComponent(tab.title)+'&v=5&jump=yes'; console.log('delicious: '+url);
	  chrome.tabs.create({'url': url });
	  //chrome.tabs.update(tab.id, {'url': url});
      });
    },

    sync: function(uname, callback){
      var uname = uname || Delicious.user;
      var url = 'http://feeds.delicious.com/v2/json/' + uname + '?count=100'; console.log('requested '+url);
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.send();
      xhr.onreadystatechange = function() {
	if (xhr.readyState == 4) {
	    Delicious.posts = JSON.parse(xhr.responseText);
	    Chromium.init(function(){ 
		console.log('Chromium inited, syncing...');
		Chromium.sync();
	    });
	};
      }
    },

    // Delicious.apiPostsAll(function(posts){console.log(posts);});
    apiPostsAll: function(callback){
	var user = SimplyDelicious.prefs.username;
	var passwd = SimplyDelicious.prefs.password;
	if (user && passwd) {
	    var url = 'https://'+user+':'+passwd+'@api.del.icio.us/v1/posts/all';
	    var xhr = new XMLHttpRequest();
	    xhr.open("GET", url, true);
	    xhr.send();
	    xhr.onreadystatechange = function() {
		if (xhr.readyState == 4) {
		    if (xhr.status == 200) {
			var data = XMLObjectifier.xmlToJSON(xhr.responseXML);
			Delicious.posts = data.post;
			callback && callback();  //data.post is an array
		    } else {
			console.log("There was a problem retrieving the XML data:\n" + xhr.statusText);
		    }
		};
	    };
	} else throw "user or passwd missing";
    },


    apiUpdate: function(callback){
	var user = SimplyDelicious.prefs.username;
	var passwd = SimplyDelicious.prefs.password;
	if (user && passwd) {
	    var url = 'https://'+user+':'+passwd+'@api.del.icio.us/v1/posts/update';
	    var xhr = new XMLHttpRequest();
	    xhr.open("GET", url, true);
	    xhr.send();
	    xhr.onreadystatechange = function() {
		if (xhr.readyState == 4) {
		    if (xhr.status == 200) {
			var data = XMLObjectifier.xmlToJSON(xhr.responseXML);
			callback && callback(data);  //data.post is an array
		    } else {
			console.log("There was a problem retrieving the XML data:\n" + xhr.statusText);
		    }
		};
	    };
	} else throw "user or passwd missing";
    }

};
