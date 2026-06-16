---
title: Home
layout: base
---

My name is Ivan and I'm IT engineer 🧑‍💻

<script>
    console.log("hello from tiny internet \"home\", stranger.")
</script>

<ul>
  {% for page in site.html_files %}
      "{{ page }}"
      <li><a href="{{ page.path }}">{{ page.title | default: page.path }}</a></li>

  {% endfor %}
</ul>
