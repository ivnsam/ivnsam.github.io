---
title: Projects
---

Things I've built, broken, rebuilt and occasionally finished.

Most of these projects started with a simple question, a problem to solve or a technology I wanted to understand better. This page serves as an archive of those experiments and the things that came out of them.

Actually this page is one of those experiments 🐾

<ul>
  {% for page in site.html_files %}
      "{{ page }}"
      <li><a href="{{ page.path }}">{{ page.title | default: page.path }}</a></li>

  {% endfor %}
</ul>
