SD = {
    log: function(text){
        var now = new Date().getTime();
        console.log(now + ': ' + text)
    }
}

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
        SD.log('preferences saved');
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
        Delicious.apiUpdate(function(data){ //TODO Make into a message to background
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
    _BOOKMARK_BAR: '1',     // These should really be Chrome constants
    _OTHER_BOOKMARKS: '2',  // Hope they don't change!

    _createFolder: function(callback){
        localStorage["folderID"] = undefined;
        chrome.bookmarks.create({'parentId':Chromium._OTHER_BOOKMARKS, 'title':Chromium.folderName}, function(newFolder){
            localStorage["folderID"] = newFolder.id;
        });
        callback && callback() // dirty hack - Stupid chrome.bookmarks.create doesn't pass callbacks along
                
    },
    init: function(callback){
        if(Chromium.folderID()) {
            chrome.bookmarks.get(Chromium.folderID(), function(results){
                if(results && results.length && results[0].title == Chromium.folderName) {
                    SD.log('Simply Delicious folder found with id: '+ results[0].id);
                } else {
                    Chromium._createFolder();
                };
            });
            callback && callback();
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
        SD.log('Delicious synchronised');
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
    checked: false,
    add: function(tab){
      chrome.tabs.getSelected(null, function(tab){
          var url = 'http://delicious.com/save?url='+encodeURIComponent(tab.url)+'&title='+encodeURIComponent(tab.title)+'&v=5&jump=yes'; SD.log('delicious: '+url);
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
                    SD.log("There was a problem retrieving the XML data:\n" + xhr.statusText);
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
                        SD.log("There was a problem retrieving the XML data:\n" + xhr.statusText);
                    };
                };
            };
        } else throw "user or passwd missing";
    },
    

    // NOTE: Only use this in background context. Invoke via messages.
    login: function(user,passwd,callback){
        var url ='https://' + user + ':' + passwd + '@api.del.icio.us/v1/posts/update';
        var options = {
                'timeout': 3000,
                    'url': url
                };
        var xhr = $.ajax(options, function(data, status){
            SD.log(data);
        });
        xhr.onreadystatechange = function(){
            if (this.statusText == 'OK') {
                Delicious.checked = true;
            } else {
                Delicious.checked = false;
            };
        };
    }
};
