---
title: Home
---

My name is Ivan and I'm IT engineer 🧑‍💻

<script>
    console.log("hello from \"home\"")
</script>

<ul>
  {% for page in site.pages %}
    {% if (page.path contains "legacy/" and page.url != "/legacy/") or (page.path contains "onepagerssreader/" and page.url != "/onepagerssreader/") and page.url.end_with?(".html") or page.url.end_with?(".html.tmpl") %}
      <li><a href="{{ page.url | relative_url }}">{{ page.title | default: page.path }}</a></li>
    {% endif %}
  {% endfor %}
</ul>