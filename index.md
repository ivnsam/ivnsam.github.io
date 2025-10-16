---
title: Home
---

My name is Ivan and I'm IT engineer 🧑‍💻

<script>
    console.log("hello from \"home\"")
</script>

<ul>
  {% for page in site.html_files %}
      <li><a href="{{ page.url | relative_url }}">{{ page.title | default: page.path }}</a></li>

  {% endfor %}
</ul>