---
layout: base
title: random index
---
{% comment %}
<!DOCTYPE html>
<html lang="en">
<head>
    <link rel='icon' type='image/gif' href='/favicon.gif' />
</head>
<body>
{% endcomment %}
<script>
    let pages = ["", "hello1", "hello2"]
    async function fetchRandIndex() {
        let randomUrl = pages[Math.floor(Math.random()*pages.length)];
        let resp = await fetch(window.location.origin + '/' + randomUrl);
        let text = await resp.text();
        console.log("hello from " + randomUrl);
        return text;
    }
    console.log("run..");
    fetchRandIndex().then(result => document.getElementsByTagName("html")[0].innerHTML = result);
    console.log("done.");
</script>
{% comment %}
</body>
</html>
{% endcomment %}