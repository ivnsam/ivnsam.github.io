function deepCopy() {

	let original = {
		name: 'Bebe',
		age: 10,
		commands: {
			voice: true,
			sit: true,
			die: false,
		},
		head: { //голова
			ears: { //ушки
				stroke: true, //гладить
				scratch: true, //чесать
			},
		},
	}

	console.log( 'origitnal: ' );
	console.log( original );
	console.log('copy: ');
	console.log( copyObject(original) );
	
}

function copyObject(obj) {
	let copy = {};

	for ( let key in obj ) {
		if ( !isObject(key) )
			copy[key] = obj[key];
		else
			copyObject( obj[key] );
	}

	return copy;
}

function isObject(val) {
	if (Object.prototype.toString.call(val).slice(8, -1) === 'Object')
		return true;
	else
		return false;
}
