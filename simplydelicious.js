SimplyDelicious = {
    prefs: {},
    defaults: {
	username: '',
	password: '',
        newtab: true,
        copylocal: true,
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
    test: function(callback){
	$('#testresult').remove();
	$('#test').before('<img id="loading" src="loading.gif" width="16px" height="16px"/>');
	Delicious.apiUpdate(function(data){
	    $('#loading').remove();
	    if(data.time){
		$('#test').before('<span id="testresult">OK</span>');
	    } else {
		$('#test').before('<span id="testresult">Fail</span>');
	    }
	});
    }
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
	    callback && callback() // dirty hack - Stupid chrome.bookmarks.create doesn't pass callbacks along
	    	    
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
    posts: [],
    add: function(tab){
      chrome.tabs.getSelected(null, function(tab){
	  var url = 'http://delicious.com/save?url='+encodeURIComponent(tab.url)+'&title='+encodeURIComponent(tab.title)+'&v=5&jump=yes'; console.log('delicious: '+url);
	  if(SimplyDelicious.prefs.newtab){
	      chrome.tabs.create({'url': url });
	  } else {
	      chrome.tabs.update(tab.id, {'url': url});
	  };
      });
    },

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
