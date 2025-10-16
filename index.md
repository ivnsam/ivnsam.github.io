---
title: Home
---

My name is Ivan and I'm IT engineer 🧑‍💻

<script>
    console.log("hello from \"home\"")
</script>

<ul>
  {% for page in site.pages %}
    {% capture main_string %}This is a test string.{% endcapture %}
    {% capture suffix %}.html{% endcapture %}

    {% assign page_url_length = page.url | size %}
    {% assign suffix_length = suffix | size %}

    {% assign start_index = page_url_length | minus: suffix_length %}
    {% assign extracted_suffix = page.url | slice: start_index, suffix_length %}

    {% if extracted_suffix == suffix %}
      <li><a href="{{ page.url | relative_url }}">{{ page.title | default: page.path }}</a></li>
    {% endif %}

  {% endfor %}
</ul>