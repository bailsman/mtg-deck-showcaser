$(document).ready(function() {
	var input_card = $("#input-card");
	var btn = $( "#input-card .btn" );
	var input = $( "#input-card #input" );
	var result = $( "#result-card #result-body" );
	input.focus(function() {
		input.select();
		input.removeClass("loaded");
	});

	function resizeFakeCards() {
		$(".fake-card").each(function() {
			var that = $(this);
			var width = that.parent().parent().width();
			that.css("height",(width*1.25)+"px");
		});
	}
	$(window).resize(resizeFakeCards);

	// Clears all visible cards, resets the columns, and returns them
	function resetResults() {
		result.empty();
		var row = $("<div class='mtg-row'></div>");
		var creatures = $("<div class='mtg-col'><strong>Creatures</strong><div class='mtg-list'></div></div>");
		var noncreatures = $("<div class='mtg-col'><strong>Non-creatures</strong><div class='mtg-list'></div></div>");
		var lands = $("<div class='mtg-col'><strong>Lands</strong><div class='mtg-list'></div></div>");
		var sideboard = $( "<div class='mtg-col'><strong>Sideboard</strong><div class='mtg-list'></div></div>");
		var columns = { "creatures":$(".mtg-list",creatures),"noncreatures":$(".mtg-list",noncreatures),
						"lands":$(".mtg-list",lands),"sideboard":$(".mtg-list",sideboard)};
		row.append([creatures,noncreatures,lands,sideboard]);
		result.append(row);

		return columns;
	}

	// Fill text box
	function buildCardInputBox( cards ) {
		var cards_list = [];

		// first extract amount, name, and set
		$.each(cards,function(category,_cards) {
			$.each(_cards,function(index,card) {
				cards_list.push({amount:card.amount,name:card.name,'set':card.set});
			});
		});

		// Sort by card amount, or alphabetically if they're the same
		cards_list.sort(function(a,b) {
			if (a.amount == b.amount) {
				return a.name.localeCompare(b.name);
			}
			return (a.amount < b.amount) ? -1 : 1;
		});

		// convert into string
		$.each(cards_list,function(idx,card) {
			cards_list[idx] = card.amount + " " + card.name + " (" + card.set + ")";
		});

		input.val(cards_list.join("\n"));
	}

	// Build share URL
	var SHARE_URL_VERSION = 1;
	function buildShareURL( cards ) {
		var cards_list = [];
		var sideboard_list = [];

		// first extract multiverseid and amount
		$.each(cards,function(category,_cards) {
			var list = cards_list;
			if (category == "sideboard") {list = sideboard_list;}

			$.each(_cards,function(index,card) {
				if (typeof card.multiverseid != "undefined") {
					list.push({
						amount:parseInt(card.amount),
						multiverseid:card.multiverseid
					});
				}
			});
		});

		// Sort by card amount
		function sort_func(a,b) {
			if (a.amount == b.amount) {return 0;}
			return (a.amount < b.amount) ? -1 : 1;
		}
		cards_list.sort(sort_func);
		sideboard_list.sort(sort_func);

		var query_list = [];

		function appendCards(list) {
			var special_chars = ["","a","b","c","d"]; // a=1,b=2,c=3,d=4 cards
			var last_amount = 1;
			$.each(list,function(idx,card) {
				// if the card amount changes, insert a special character as long as amount <= 4, or else insert the literal amount
				if (card.amount <= 4) {
					if (card.amount != last_amount) {
						query_list.push(special_chars[card.amount]);
						last_amount = card.amount;
					}
				} else {
					if (last_amount != 0) {
						query_list.push("n"); // n="normal", count each card individually
						last_amount = 0;
					}
					query_list.push(card.amount);
				}

				query_list.push(card.multiverseid);
			});
		}

		appendCards(cards_list);

		var query_string = query_list.join(",");

		if (sideboard_list.length > 0) {
			query_list = [];
			appendCards(sideboard_list);
			query_string += "s" + query_list.join(","); // s="sideboard"
		}

		// Always insert the version first
		query_string = SHARE_URL_VERSION + query_string;
		location.hash = LZString.compressToEncodedURIComponent(query_string);
	}

	// Displays cards
	function displayCards( cards ) {
		var columns = resetResults();

		var all_amount = 0;
		$.each(cards,function(card_category,_cards) {
			var total_amount = 0;

			_cards.sort(function(a,b) {
				if (a.cmc == b.cmc) {
					// if cmc is the same, sort by name
					return a.name.localeCompare(b.name);
				}
				return a.cmc < b.cmc ? -1 : 1;
			});

			var parent = columns[card_category];
			var num_child = 0;

			$.each(_cards,function(idx,card) {
				var amount = card.amount;
				total_amount += amount;

				if (amount > 4) {
					parent.append(card.a);
					card.a.append($("<div class='card-counter'>" + amount + "x</div>").hide());
					num_child++;
				} else {
					for(var i=0;i<amount;i++) {
						parent.append(card.a.clone());
						num_child++;
					}
				}
			});

			if (card_category != "sideboard") {
				all_amount += total_amount;
			}
			var that = $("strong",parent.parent());
			that.html(that.text() + " (<span class='mtg-list-amount'>" + total_amount + "</span>)");
		});

		// Automatically split columns up if they're too tall
		// Also checks if columns are empty and hides them
		var split_count = all_amount / 5; // if a column is this large, attempt split
		var min_split_count = 6; // only split if the resulting column has at least this many cards
		$.each(columns,function(card_category,pnl) {
			var children = pnl.children();
			var child_count = children.length;

			if (child_count == 0) {
				pnl.parent().hide();
				return;
			}

			if (child_count > split_count) {
				var new_pnl = pnl.parent().clone();
				$(".mtg-list",new_pnl).empty();
				var move_children = [];
				var previous_url = "";
				for(var i=0;i<child_count;i++) {
					if (i>Math.floor(child_count/2) && $(children[i]).attr("href") != previous_url) {
						move_children.push(children[i]);
					} else {
						previous_url = $(children[i]).attr("href");
					}
				}

				if (move_children.length > min_split_count) {
					$(move_children).detach().appendTo($(".mtg-list",new_pnl));
					new_pnl.insertAfter(pnl.parent());
					$(".mtg-list-amount",pnl.parent()).text(child_count - move_children.length);
					$(".mtg-list-amount",new_pnl).text(move_children.length);
				}
			}
		});

		result.prepend("<strong>Nr of cards: " + all_amount + "</strong><br>");

		function showImg(that) {
			$(".card-counter",that.parent()).show();
			$(".fake-card",that.parent()).remove();
			if (!that.hasClass("secondary-card")) {
				that.show();
			}
		}

		$("img",result).on("load", function() {
			showImg($(this));
		}).each(function() {
			if(this.complete) {
				showImg($(this));
			} else {
				var parent = $(this).parent();
				if (parent.is(":first-child")) {
					parent.append("<div class='fake-card'></div>"); // insert fake card
				}
			}
		});

		$("#result-card .collapse").collapse("show");
		resizeFakeCards();
		setTimeout(function() {resizeFakeCards();},200);
	}

	// returns {image:<string>,border_class:<string>}
	function getCardImage(card) {
		var image = "";
		var fix_border_class = "";
		var multi_images = {split:true, flip:true, transform:true, double_faced_token:true};
		if (multi_images[card.layout]) {
			if (card.card_faces[0].image_uris) {
				if (card.card_faces[0].image_uris.border_crop) {
					image = card.card_faces[0].image_uris.border_crop;
					fix_border_class = "fix-border";
				} else {
					image = card.card_faces[0].image_uris.png;
				}
			}
		}

		if (image == "") {
			if (card.image_uris) {
				if (card.image_uris.border_crop) {
					image = card.image_uris.border_crop;
					fix_border_class = "fix-border";
				} else {
					image = card.image_uris.png;
				}
			}
		}

		return {image:image,border_class:fix_border_class};
	}

	function processCard(card,cards,amount,in_sideboard) {
		var name = card.name;
		var type = card.type_line;
		var image = getCardImage(card);
		var fix_border_class = image.border_class;
		image = image.image;

		if (typeof image == "undefined") {
			alert("Warning: Card '" + card.name + "' doesn't have an image!");
		}

		var card_category = "creatures";
		if (in_sideboard) {
			card_category = "sideboard";
		} else {
			if (type.toLowerCase().indexOf("creature") == -1) {card_category = "noncreatures";}
			if (type.toLowerCase().indexOf("land") != -1) {card_category = "lands";}
		}

		//var card_url = "http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=" + card.multiverseid;
		var card_url = card.scryfall_uri;

		var a = $("<a target='_blank' href='"+card_url+"' class='mtg-card'></a>");

		if (typeof card.card_faces != "undefined") { // multiple faces, load all
			// add images for other faces
			var len = card.card_faces.length;
			for(var i=0;i<len;i++) {
				let m = getCardImage(card.card_faces[i]);
				if (m.image == "") { // no image was found, fall back to the base image and abort
					m.image = image;
					m.border_class = fix_border_class;
					len = -1; // abort after this
				}
				let img_2 = $("<img>").attr("src",m.image).addClass(m.border_class);
				if (i>0) {img_2.addClass("secondary-card");}
				a.append(img_2);
			}
		} else { // just one face, load it
			var img = $("<img>").attr("src",image).addClass(fix_border_class);
			img.hide();
			a.append(img);
		}

		if (typeof cards[card_category] == "undefined") {cards[card_category] = [];}
		cards[card_category].push({
			name: name,
			amount: amount,
			image: image,
			a: a,
			cmc: card.cmc,
			multiverseid:card.multiverse_ids[0],
			'set': card.set
		});
	}

	function loadCardsFromInput() {
		var txt = input.val().trim();
		var lines = txt.split("\n");

		var requests = {};
		var amount_by_name = {};
		var amount_by_name_set = {};
		var found_cards = {};
		var error_parsing_deck = false;

		var in_sideboard = false;

		$.each(lines,function(row,line) {
			line = line.trim();

			if (line == "" || line.toLowerCase().indexOf("sideboard") != -1) {
				in_sideboard = true;
				return;
			}

			try {
				var re = /^(\d*) (.*?) ?(\((.*?)\))? ?(\d*)?$/i;
				var match = line.match(re);

				var amount = parseInt(match[1]);
				var name = match[2];
				var set = match[4] || "*";

				if (set == "DAR") {set = "DOM";} // Hopefully temporary, check back later, maybe erase

				/*
				if (set == "*") {
					alert("Set unspecified for card '" + name + "'! For now, the API doesn't have a good way to search for cards without a set, so I'm gonna need you to specify one. Action aborted.");
					return false;
				}
				*/
			} catch(e) {
				alert("Error parsing deck: " + e);
				error_parsing_deck = true;
				return false;
			}

			if (in_sideboard) {
				set = "SIDEBOARD" + set;
			}

			amount_by_name[name.toLowerCase()] = amount;
			amount_by_name_set[name.toLowerCase() + set.toLowerCase()] = amount;
			found_cards[name.toLowerCase()] = false;

			if (typeof requests[set] == "undefined") {
				requests[set] = [[]];
			}

			if (requests[set][0].length >= 25) { // the limit is 175 requests, but we're limiting ourselves to 25 to be safe
				requests[set].unshift([]);
			}

			requests[set][0].push(name);
		});

		if (error_parsing_deck) {return;} // abort

		hideInput();

		var cards = {};
		var num_requests = 0;
		var no_mid = [];

		$.each(requests,function(set,arr) {
			$.each(arr,function(idx,names) {
				var params = {};

				$.each(names,function(idx,name) {
					names[idx] = "!\"" + name + "\""; // Prefix each name with "!" and add quotes " " which makes it an exact match
				})

				params.q = names.join(" or ");

				var in_sideboard = false;
				if (set.indexOf("SIDEBOARD") == 0) {
					set = set.substr(9);
					in_sideboard = true;
				}

				if (set.indexOf("*") == -1) {
					params.q = "s:" + set + " (" + params.q + ")"; // Add set, and group all cards in brackets
				} 

				params.unique = "cards"; // Always find one copy of each card
				params.order = "released"; // Always sort by newest first
				params.dir = "asc";

				var request_string = $.param(params);
				var url = "https://api.scryfall.com/cards/search?" + request_string;

				num_requests++;
				var x = $.get( url, function(data) {
					$.each(data.data,function(idx,card) {
						//if (found_cards[card.name] == true) {return;}
						found_cards[card.name.toLowerCase()] = true;

						if (card.multiverse_ids.length == 0) {
							no_mid.push(card.name);
						}

						var amount = (amount_by_name_set[card.name.toLowerCase() + card.set] || amount_by_name[card.name.toLowerCase()]) || 0;

						// checks for other card faces
						if (amount == 0) {
							if (typeof card.card_faces != "undefined") {
								for(var i=0;i<card.card_faces.length;i++) {
									let face = card.card_faces[i];
									found_cards[face.name.toLowerCase()] = true;

									if (typeof amount_by_name_set[face.name.toLowerCase() + face.set] != "undefined") {
										amount = amount_by_name_set[face.name.toLowerCase() + face.set];
									} else if (typeof amount_by_name[face.name.toLowerCase()] != "undefined") {
										amount = amount_by_name[face.name.toLowerCase()];
									}
								}
							}
						}

						processCard(card,cards,amount,in_sideboard);
					});
				});

				x.always(function() {
					num_requests--;

					if (num_requests == 0) {
						var not_found = [];
						$.each(found_cards,function(name,b) {
							if (b == false) {
								not_found.push(name);
							}
						});

						if (not_found.length > 0) {
							alert( "Card(s) '" + not_found.join("; ") + "' not found! It's possible the API hasn't been updated yet.");
						}

						if (no_mid.length > 0) {
							alert( "Card(s) '" + no_mid.join("; ") + "' have no multiverse id! "+
									"These cards cannot be encoded into the URL and will therefore not show up if you send the link to someone. "+
									"It's possible the API hasn't been updated yet." );
						}

						displayCards(cards);
						buildShareURL(cards);
					}
				})
			});
		});
	}

	function loadCardsFromURL() {
		var txt = location.hash.substr(1);
		var decompressed = LZString.decompressFromEncodedURIComponent(txt);
		if (decompressed == "" || decompressed == null) {return;}

		// First character is always the version of the encoded string, extract it
		var version = decompressed.substr(0,1);
		// Currently there's only one version so no extra behavior is processed here, but could be in the future
		decompressed = decompressed.substr(1);

		// if the user is using an old version of an url, there might be a comma in the beginning, remove it
		if (decompressed.substr(0,1) == ",") {
			decompressed = decompressed.substr(1);
		}

		// first split by sideboard
		var split_sideboard = decompressed.split("s");

		var amount_by_multiverseid = {};
		
		function readData(str) {
			var requests = [[]];

			var split = str.split(",");
			if (split.length == 0) {return;}

			var special_chars = {"b":2,"c":3,"d":4};

			var current_amount = 1;
			var literal_amount = false;
			var literal_amount_step = false;
			$.each(split,function(idx,value) {
				if (value == "n") {
					literal_amount = true;
				} else if (typeof special_chars[value] != "undefined") {
					current_amount = special_chars[value];
				} else {
					value = parseInt(value);
					if (literal_amount) literal_amount_step = !literal_amount_step;

					if (literal_amount && literal_amount_step) {
						current_amount = value;
					} else {
						amount_by_multiverseid[value] = current_amount;

						if (requests[0].length >= 60) { // max is 75, limit to 60 to be safe
							requests.unshift([]);
						}

						requests[0].push(value);
					}
				}
			});

			return requests;
		}

		var requests = readData(split_sideboard[0]);
		var requests_sideboard;
		if (typeof split_sideboard[1] != "undefined") {
			requests_sideboard = readData(split_sideboard[1]);
		}

		hideInput();
		var cards = {};
		var num_requests = 0;
		var fetched_cards = {};

		function processRequests(req,is_sideboard) {
			$.each(req,function(idx,multiverseids) {
				num_requests++;

				var params = {};
				params.identifiers = [];
				$.each(multiverseids,function(idx,m_id) {
					params.identifiers.push({multiverse_id:m_id});
				});

				var url = "https://api.scryfall.com/cards/collection";
				var x = $.ajax({
					url:"https://api.scryfall.com/cards/collection",
					method:"POST",
					data:JSON.stringify(params),
					crossOrigin:true,
					contentType:"application/json",
					dataType:"json",
					xhrFields: {
						withCredentials: false
					},
					success: function(data){
						$.each(data.data,function(idx,card) {
							fetched_cards[card.name] = true;

							var amount = 1;
							for(var i=0;i<card.multiverse_ids.length;i++) {
								if (amount_by_multiverseid[card.multiverse_ids[i]]) {
									amount = amount_by_multiverseid[card.multiverse_ids[i]];
									break;
								}
							}

							processCard(card,cards,amount,is_sideboard);
						});
					}
				});

				x.always(function() {
					num_requests--;

					if (num_requests == 0) {
						displayCards(cards);
						buildCardInputBox(cards);
					}
				})
			});
		}

		processRequests(requests,false);
		if (typeof requests_sideboard != "undefined") {
			processRequests(requests_sideboard,true);
		}
	}

	var btn_other_deck = $(".btn-sm",input_card);
	function hideInput() {
		btn.hide();
		btn_other_deck.show();
		$(".collapse",input_card).collapse("hide");
	}

	function showInput() {
		btn.show();
		btn_other_deck.hide();
		$(".collapse",input_card).collapse("show");
	}

	var old_input_text = "";
	btn.click(function() {
		if (old_input_text == input.val()) {
			hideInput(); return;
		}
		old_input_text = input.val();

		loadCardsFromInput();
	});

	btn_other_deck.click(showInput);

	if (location.hash != "") {
		loadCardsFromURL();
	}
});