# Life-Including-Rules

2D cellular automaton, part of which defines its birth/death rules.

Actipaper (draft): https://serhon.github.io/lir/

## Embedding

Versions of the script are accumulated in `garette`. While you *could* embed it like this:

```html
<head>
	...
	<script type="text/javascript">LIR = {fieldSizeLog: 7, framerate: 20, showAgecolors: true}</script>
	...
</head>
<body>
	...
	<script src="https://github.com/serhon/lir/garette/life_inc_rules-0.3.0.js"> type="text/javascript"></script>
	...
</body>
```

(see `index.html` for an example of setting all parameters that can be set with `LIR` object),
*it is unsafe to embed scripts from untrusted sources*. Thus the better way is to copy `.js` to your server, read it thoroughly to be sure there are no nasty things, and *only then* embed it like this:

```html
<script src="/scripts/life_inc_rules-0.3.0.js"> type="text/javascript"></script>
```

If you modify the script, please rename it or keep the link to origin.