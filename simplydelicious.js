//
//    Copyright 2009 Rich Atkinson http://jetfar.com/
//    
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

// SD - a shorthand utility object
SD = {
    log: function(text){
        var now = new Date().getTime();
        console.log(now + ': ' + text)
    }
}

// SimplyDelicious - Options, the UI etc.
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
        MQ.send('save');
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
    test: function(){
        $('#testresult').remove();
        $('#checking').remove();
        $('#test').before('<span id="checking">checking...</span>');
        MQ.send("logintest");
        MQ.listener(
            function(msg) {
                $('#loading').remove();
                if(msg.event == 'logintest.OK')
                    $('#test').before('<span id="testresult" class="good">OK</span>')
                else if(msg.event == 'logintest.FAIL')
                    $('#test').before('<span id="testresult" class="bad">Fail</span>')
                else SD.log('recieved mesage but not understood: ' + msg.event)
            }
        );
    }
}

Chromium = {
    folderName: 'Simply Delicious',
    folderID: function(){return localStorage["folderID"]},
    _BOOKMARK_BAR: '1',     // These should really be Chrome constants
    _OTHER_BOOKMARKS: '2',  // Hope they don't change!

    _createFolder: function(){
        localStorage["folderID"] = undefined;
        chrome.bookmarks.create(
                                {'parentId':Chromium._OTHER_BOOKMARKS,
                                 'title':Chromium.folderName
                                }, 
                                function(newFolder){
                                    localStorage["folderID"] = newFolder.id;
                                }
        );
    },
    init: function(){
        if(Chromium.folderID()) {
            chrome.bookmarks.get(Chromium.folderID(), 
                function(res){
                    var exists = (res && res.length && res[0].title == Chromium.folderName)
                    if (!exists) Chromium._createFolder(); // TODO tidy this shit up
                }
            );
        } else {
            Chromium._createFolder();
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
                } else {
                    SD.log("There was a problem retrieving the XML data:\n" + xhr.statusText);
                }
            };
            };
        } else callback && callback();
    },

    // returns a short message with the dat of last updated. Keep to compare.
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
                        //TODO - what to do with it?
                    } else {
                        SD.log("There was a problem retrieving the XML data:\n" + xhr.statusText);
                    };
                };
            };
        } else callback && callback();
    },
    // NOTE: Only use this in background. Invoke via MQ.send('logintest')
    login: function(){
        var user = SimplyDelicious.prefs.username;
        var passwd = SimplyDelicious.prefs.password;
        var url ='https://' + user + ':' + passwd + '@api.del.icio.us/v1/posts/update';
        var options = {
                'url':     url,
                'timeout': 5000
                };
        var xhr = $.ajax(options);
        SD.log('testing delicious creds');
        xhr.onreadystatechange = function(){ // TODO this aint working
            if (xhr.readyState == 4) {
                if (xhr.statusText == 'OK') {
                    SD.log('creds OK');
                    MQ.send('logintest.OK');
                } else {
                    SD.log('creds FAIL');
                    MQ.send('logintest.FAIL '+ xhr.statusText);
                }
            }
        }
    }
};


MQ = {
    port: undefined, // the connection port
    
    send: function(evt, callback){
        if (MQ.port == undefined)
            MQ.port = chrome.extension.connect({name:"messages"});
        MQ.port.postMessage({event:evt});
        callback && callback();
    },
    
    listener: function(callback){
        MQ.port.onMessage.addListener(callback);
    }
};






