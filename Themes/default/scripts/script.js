/*!
 * Wedge
 *
 * These are the core JavaScript functions used on most pages generated by Wedge.
 *
 * @package wedge
 * @copyright 2010-2011 Wedgeward, wedge.org
 * @license http://wedge.org/license/
 *
 * @version 0.1
 */

var
	weEditors = [],
	_formSubmitted = false,
	_lastKeepAliveCheck = new Date().getTime(),

	// Basic browser detection
	ua = navigator.userAgent.toLowerCase(),
	vers = $.browser.version,

	// If you need support for more versions, just test for $.browser.version yourself...
	is_opera = $.browser.opera, is_opera95up = is_opera && vers >= 9.5,
	is_ff = ua.indexOf('gecko/') != -1 && ua.indexOf('like gecko') == -1 && !is_opera, is_gecko = !is_opera && ua.indexOf('gecko') != -1,
	is_webkit = $.browser.webkit, is_chrome = ua.indexOf('chrome') != -1, is_iphone = is_webkit && ua.indexOf('iphone') != -1 || ua.indexOf('ipod') != -1,
	is_android = is_webkit && ua.indexOf('android') != -1, is_safari = is_webkit && !is_chrome && !is_iphone && !is_android,
	is_ie = $.browser.msie && !is_opera, is_ie6 = is_ie && vers == 6, is_ie7 = is_ie && vers == 7,
	is_ie8 = is_ie && vers == 8, is_ie8down = is_ie && vers < 9, is_ie9up = is_ie && !is_ie8down;

// Load an XML document using Ajax.
function getXMLDocument(sUrl, funcCallback)
{
	return $.ajax(typeof funcCallback != 'undefined' ?
		{ url: sUrl, success: funcCallback, context: this } :
		{ url: sUrl, async: false, context: this }
	);
}

// Send a post form to the server using Ajax.
function sendXMLDocument(sUrl, sContent, funcCallback)
{
	$.ajax($.extend({}, { url: sUrl, data: sContent, type: 'POST', context: this }, typeof funcCallback != 'undefined' ? { success: funcCallback } : {}));
	return true;
}

String.prototype.php_urlencode = function ()
{
	return encodeURIComponent(this);
};

String.prototype.php_htmlspecialchars = function ()
{
	return this.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

String.prototype.php_unhtmlspecialchars = function ()
{
	return this.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
};

String.prototype.removeEntities = function ()
{
	return this.replace(/&(amp;)?#(\d+);/g, function (sInput, sDummy, sNum) {
		return String.fromCharCode(parseInt(sNum, 10));
	});
};

// Open a new popup window.
function reqWin(from, alternateWidth, alternateHeight, noScrollbars, noDrag, asWindow)
{
	var
		help_page = from && from.href ? from.href : from,
		vpw = $(window).width() * 0.8, vph = $(window).height() * 0.8, nextSib,
		helf = '#helf', $helf = $(helf), previousTarget = $helf.data('src'), auto = 'auto', title = $(from).text();

	alternateWidth = alternateWidth ? alternateWidth : 480;
	if ((vpw < alternateWidth) || (alternateHeight && vph < alternateHeight))
	{
		noScrollbars = 0;
		alternateWidth = Math.min(alternateWidth, vpw);
		alternateHeight = Math.min(alternateHeight, vph);
	}
	else
		noScrollbars = noScrollbars && (noScrollbars === true);

	if (asWindow)
	{
		window.open(help_page, 'requested_popup', 'toolbar=no,location=no,status=no,menubar=no,scrollbars=' + (noScrollbars ? 'no' : 'yes') + ',width=' + (alternateWidth ? alternateWidth : 480) + ',height=' + (alternateHeight ? alternateHeight : 220) + ',resizable=no');
		return false;
	}

	// Try and get the title for the current link.
	if (!title)
	{
		nextSib = from.nextSibling;
		// Newlines are seen as stand-alone text nodes, so skip these...
		while (nextSib && nextSib.nodeType == 3 && $.trim($(nextSib).text()) === '')
			nextSib = nextSib.nextSibling;
		// Get the final text, remove any dfn (description) tags, and trim the rest.
		title = $.trim($(nextSib).clone().find('dfn').remove().end().text());
	}

	// If the reqWin event was created on the fly, it'll bubble up to the body and cancel itself... Avoid that.
	$.event.fix(window.event || {}).stopPropagation();

	// Clicking the help icon twice should close the popup and remove the global click event.
	if ($('body').unbind('click.h') && $helf.remove().length && previousTarget == help_page)
		return false;

	// We create the popup inside a dummy div to fix positioning in freakin' IE.
	$('<div class="windowbg wrc' + (noDrag && (noDrag === true) ? ' nodrag' : '') + '"></div>')
		.hide()
		.load(help_page, function () {
			if (title)
				$('.windowbg2', this).first().prepend('<h6 class="top">' + title + '</h6>');
			$(this).css({
				overflow: noScrollbars ? 'hidden' : auto,
				width: alternateWidth - 25,
				height: alternateHeight ? alternateHeight - 20 : auto,
				padding: '10px 12px 12px',
				border: '1px solid #999'
			}).fadeIn(300);
			$(helf).dragslide();
		}).appendTo(
			$('<div id="helf"></div>').data('src', help_page).css({
				position: is_ie6 ? 'absolute' : 'fixed',
				width: alternateWidth,
				height: alternateHeight ? alternateHeight : auto,
				bottom: 10,
				right: 10
			}).appendTo('body')
		);

	// Clicking anywhere on the page should close the popup. The namespace is for the earlier unbind().
	$(document).bind('click.h', function (e) {
		// If we clicked somewhere in the popup, don't close it, because we may want to select text.
		if (!$(e.srcElement).parents(helf).length)
		{
			$(helf).remove();
			$(this).unbind(e);
		}
	});

	// Return false so the click won't follow the link ;)
	return false;
}

// Checks if the passed input's value is nothing.
function isEmptyText(theField)
{
	return $.trim(theField.value) === '';
}

// Only allow form submission ONCE.
function submitonce()
{
	_formSubmitted = true;

	// If there are any editors warn them submit is coming!
	for (var i = 0; i < weEditors.length; i++)
		weEditors[i].doSubmit();
}

function submitThisOnce(oControl)
{
	// Hateful fix for Safari 1.3 beta.
	if (!is_safari || vers >= 2)
		$('textarea', 'form' in oControl ? oControl.form : oControl).attr('readOnly', true);

	return !_formSubmitted;
}

// Checks for variable in an array.
function in_array(variable, theArray)
{
	return $.inArray(variable, theArray) != -1;
}

// Find a specific radio button in its group and select it.
function selectRadioByName(oRadioGroup, sName)
{
	if (!('length' in oRadioGroup))
		return oRadioGroup.checked = true;

	for (var i = 0, n = oRadioGroup.length; i < n; i++)
		if (oRadioGroup[i].value == sName)
			return oRadioGroup[i].checked = true;

	return false;
}

// Invert all checkboxes at once by clicking a single checkbox.
function invertAll(oInvertCheckbox, oForm, sMask, bIgnoreDisabled)
{
	for (var i = 0, n = oForm.length; i < n; i++)
	{
		if (!('name' in oForm[i]) || (typeof sMask == 'string' && oForm[i].name.substr(0, sMask.length) != sMask && oForm[i].id.substr(0, sMask.length) != sMask))
			continue;

		if (!oForm[i].disabled || (typeof bIgnoreDisabled == 'boolean' && bIgnoreDisabled))
			oForm[i].checked = oInvertCheckbox.checked;
	}
}

// Keep the session alive - always!
function _sessionKeepAlive()
{
	var curTime = new Date().getTime();

	// Prevent a Firefox bug from hammering the server.
	if (we_script && curTime - _lastKeepAliveCheck > 900000)
	{
		var tempImage = new Image();
		tempImage.src = we_prepareScriptUrl() + 'action=keepalive;time=' + curTime;
		_lastKeepAliveCheck = curTime;
	}
	setTimeout(_sessionKeepAlive, 1200000);
}
setTimeout(_sessionKeepAlive, 1200000);

// Set a theme option through javascript.
function we_setThemeOption(option, value, theme, cur_session_id, cur_session_var, additional_vars)
{
	var tempImage = new Image();
	tempImage.src = we_prepareScriptUrl() + 'action=jsoption;var=' + option + ';val=' + value + ';' + cur_session_var + '=' + cur_session_id + (additional_vars || '') + (theme == null ? '' : '&th=' + theme) + ';time=' + (new Date().getTime());
}

function we_avatarResize()
{
	var tempAvatars = [], j = 0, maxWidth = we_avatarMaxSize[0], maxHeight = we_avatarMaxSize[1];
	$('img.avatar').each(function () {
		tempAvatars[j] = new Image();
		tempAvatars[j].avatar = this;

		$(tempAvatars[j++]).load(function () {
			var ava = this.avatar;
			ava.width = this.width;
			ava.height = this.height;
			if (maxWidth != 0 && this.width > maxWidth)
			{
				ava.height = (maxWidth * this.height) / this.width;
				ava.width = maxWidth;
			}
			if (maxHeight != 0 && ava.height > maxHeight)
			{
				ava.width = (maxHeight * ava.width) / ava.height;
				ava.height = maxHeight;
			}
		}).attr('src', this.src);
	});
}


// Shows the page numbers by clicking the dots (in compact view).
function expandPages(spanNode, firstPage, lastPage, perPage)
{
	var replacement = '', i = firstPage, oldLastPage, perPageLimit = 50, baseURL = $(spanNode).data('href');

	// Prevent too many pages to be loaded at once.
	if ((lastPage - firstPage) / perPage > perPageLimit)
	{
		oldLastPage = lastPage;
		lastPage = firstPage + perPageLimit * perPage;
	}

	// Calculate the new pages.
	for (; i < lastPage; i += perPage)
		replacement += '<a href="' + baseURL.replace(/%1\$d/, i).replace(/%%/g, '%') + '">' + (1 + i / perPage) + '</a> ';

	if (oldLastPage)
		replacement += '<a data-href="' + baseURL + '" onclick="expandPages(this, ' + lastPage + ', ' + oldLastPage + ', ' + perPage + ');">&hellip;</a> ';

	$(spanNode).before(replacement).remove();
}


// *** weCookie class.
function weCookie(oOptions)
{
	this.opt = oOptions;
	this._cookies = {};

	if ('cookie' in document && document.cookie != '')
	{
		var aCookieList = document.cookie.split(';');
		for (var i = 0, n = aCookieList.length; i < n; i++)
		{
			var aNameValuePair = aCookieList[i].split('=');
			this._cookies[aNameValuePair[0].replace(/^\s+|\s+$/g, '')] = decodeURIComponent(aNameValuePair[1]);
		}
	}
};

weCookie.prototype.get = function (sKey)
{
	return sKey in this._cookies ? this._cookies[sKey] : null;
};

weCookie.prototype.set = function (sKey, sValue)
{
	document.cookie = sKey + '=' + encodeURIComponent(sValue);
};


// *** weToggle class.
function weToggle(oOptions)
{
	this.opt = oOptions;
	this._collapsed = false;
	this._cookie = null;

	// If cookies are enabled and they were set, override the initial state.
	if ('oCookieOptions' in this.opt && this.opt.oCookieOptions.bUseCookie)
	{
		// Initialize the cookie handler.
		this._cookie = new weCookie({});

		// Check if the cookie is set.
		var cookieValue = this._cookie.get(this.opt.oCookieOptions.sCookieName);
		if (cookieValue != null)
			this.opt.bCurrentlyCollapsed = cookieValue == '1';
	}

	// If the init state is set to be collapsed, collapse it.
	if (this.opt.bCurrentlyCollapsed)
		this._changeState(true, true, true);

	// Initialize the images to be clickable.
	var i, n, toggle_me = function () {
		$(this).data('that').toggle();
		this.blur();
		return false;
	};

	if ('aSwapImages' in this.opt)
		for (i = 0, n = this.opt.aSwapImages.length; i < n; i++)
			$('#' + this.opt.aSwapImages[i].sId).show().css('visibility', 'visible').data('that', this).click(toggle_me).css('cursor', 'pointer').mousedown(false);

	// Initialize links.
	if ('aSwapLinks' in this.opt)
		for (i = 0, n = this.opt.aSwapLinks.length; i < n; i++)
			$('#' + this.opt.aSwapLinks[i].sId).show().data('that', this).click(toggle_me);
};

// Collapse or expand the section.
weToggle.prototype._changeState = function (bCollapse, bInit, bNow)
{
	// Default bInit to false.
	bInit = !!bInit;
	var i, n, o, op, iSpeed = bNow ? 0 : 300;

	// Handle custom function hook before collapse.
	if (!bInit && bCollapse && 'funcOnBeforeCollapse' in this.opt)
		this.opt.funcOnBeforeCollapse.call(this);

	// Handle custom function hook before expand.
	else if (!bInit && !bCollapse && 'funcOnBeforeExpand' in this.opt)
		this.opt.funcOnBeforeExpand.call(this);

	// Loop through all the images that need to be toggled.
	if ('aSwapImages' in this.opt)
	{
		op = this.opt.aSwapImages;
		for (i = 0, n = op.length; i < n; i++)
		{
			var sAlt = bCollapse && op[i].altCollapsed ? op[i].altCollapsed : op[i].altExpanded, icon = $('#' + op[i].sId);
			icon.toggleClass('fold', !bCollapse).attr('title', sAlt);
		}
	}

	// Loop through all the links that need to be toggled.
	if ('aSwapLinks' in this.opt)
		for (i = 0, op = this.opt.aSwapLinks, n = op.length; i < n; i++)
			$('#' + op[i].sId).html(bCollapse && op[i].msgCollapsed ? op[i].msgCollapsed : op[i].msgExpanded);

	// Now go through all the sections to be collapsed.
	for (i = 0, op = this.opt.aSwappableContainers, n = op.length; i < n; i++)
		(o = $('#' + op[i])) && bCollapse ? o.slideUp(iSpeed) : o.slideDown(iSpeed);

	// Update the new state.
	this._collapsed = bCollapse;

	// Update the cookie, if desired.
	if ('oCookieOptions' in this.opt && (op = this.opt.oCookieOptions) && op.bUseCookie)
		this._cookie.set(op.sCookieName, this._collapsed ? '1' : '0');

	if ('oThemeOptions' in this.opt && (op = this.opt.oThemeOptions) && op.bUseThemeSettings)
		we_setThemeOption(op.sOptionName, this._collapsed ? '1' : '0', 'sThemeId' in op ? op.sThemeId : null, op.sSessionId, op.sSessionVar, 'sAdditionalVars' in op ? op.sAdditionalVars : null);
};

// Reverse the current state.
weToggle.prototype.toggle = function ()
{
	this._changeState(!this._collapsed);
};


function ajax_indicator(turn_on)
{
	// Create the div for the indicator, and add the image, link to turn it off, and loading text.
	if (turn_on)
		$('<div id="ajax_in_progress"></div>').html('<a href="#" onclick="ajax_indicator(false);"' +
			(ajax_notification_cancel_text ? ' title="' + ajax_notification_cancel_text + '"' : '') + '></a>' + ajax_notification_text
		).css(is_ie6 ? { position: 'absolute', top: $(document).scrollTop() } : {}).appendTo('body');
	else
		$('#ajax_in_progress').remove();
}

function selectText(box)
{
	box.focus();
	box.select();
}

// Rating boxes in Media area
function ajaxRating()
{
	$('#ratingElement').html('<img src="' + (typeof we_default_theme_url == "undefined" ? we_theme_url : we_default_theme_url) + '/images/loader.gif">');
	sendXMLDocument($('#ratingForm').attr('action') + ';xml', 'rating=' + $('#rating').val(), ajaxRating2);
}

function ajaxRating2(XMLDoc)
{
	$('#ratingElement').html($('ratingObject', XMLDoc).text());
}

// Find the actual position of an item.
// This is a dummy replacement for add-ons -- might be removed later.
function we_itemPos(itemHandle)
{
	var offset = $(itemHandle).offset();
	return [offset.left, offset.top];
}

// This function takes the script URL and prepares it to allow the query string to be appended to it.
// It also replaces the host name with the current one. Which is required for security reasons.
function we_prepareScriptUrl()
{
	var finalUrl = we_script.indexOf('?') == -1 ? we_script + '?' : we_script +
		(we_script.charAt(we_script.length - 1) == '?' || we_script.charAt(we_script.length - 1) == '&' || we_script.charAt(we_script.length - 1) == ';' ? '' : ';');
	return finalUrl.replace(/:\/\/[^\/]+/g, '://' + window.location.host);
}

// Get the text in a code tag.
function weSelectText(oCurElement, bActOnElement)
{
	// The place we're looking for is one div up, and next door - if it's auto detect.
	var oCodeArea = (typeof bActOnElement == 'boolean' && bActOnElement) ? $('#' + oCurElement)[0] : oCurElement.parentNode.nextSibling, oCurRange;

	if (typeof oCodeArea != 'object' || oCodeArea == null)
		return false;

	// Start off with IE
	if ('createTextRange' in document.body)
	{
		oCurRange = document.body.createTextRange();
		oCurRange.moveToElementText(oCodeArea);
		oCurRange.select();
	}
	// Firefox et al.
	else if (window.getSelection)
	{
		var oCurSelection = window.getSelection();
		// Safari is special!
		if (oCurSelection.setBaseAndExtent)
		{
			var oLastChild = oCodeArea.lastChild;
			oCurSelection.setBaseAndExtent(oCodeArea, 0, oLastChild, 'innerText' in oLastChild ? oLastChild.innerText.length : oLastChild.textContent.length);
		}
		else
		{
			oCurRange = document.createRange();
			oCurRange.selectNodeContents(oCodeArea);

			oCurSelection.removeAllRanges();
			oCurSelection.addRange(oCurRange);
		}
	}

	return false;
}

// A function needed to discern HTML entities from non-western characters.
function weSaveEntities(sFormName, aElementNames, sMask)
{
	var i, f = document.forms, nm = f[sFormName], e = nm.elements, n = e.length;
	if (typeof sMask == 'string')
		for (i = 0; i < n; i++)
			if (e[i].id.substr(0, sMask.length) == sMask)
				aElementNames.push(e[i].name);

	for (i = 0, n = aElementNames.length; i < n; i++)
		if (aElementNames[i] in nm)
			nm[aElementNames[i]].value = nm[aElementNames[i]].value.replace(/&#/g, '&#38;#');
}

(function ($) {
	var origMouse, currentPos, is_moving = 0, is_fixed, currentDrag = 0;

	// You may set an area as non-draggable by adding the nodrag class to it.
	// This way, you can drag the element, but still access UI elements within it.
	$.fn.dragslide = function () {
		var origin = this.selector;
		return this.each(function () {
			$(this).css("cursor", "move").find(".nodrag").css("cursor", "default");

			// Start the dragging process
			$(this).mousedown(function (e) {
				if ($(e.target).parentsUntil(origin).andSelf().hasClass("nodrag"))
					return true;
				is_fixed = this.style.position == "fixed";

				// Position it to absolute, except if it's already fixed
				$(this).css({ position: is_fixed ? "fixed" : "absolute", zIndex: 999 });

				origMouse = { X: e.pageX, Y: e.pageY };
				currentPos = { X: parseInt(is_fixed ? this.style.right : this.offsetLeft, 10), Y: parseInt(is_fixed ? this.style.bottom : this.offsetTop, 10) };
				currentDrag = this;

				return false;
			});
		});
	};

	// Updates the position during the dragging process
	$(document)
		.mousemove(function (e) {
			if (currentDrag)
			{
				// If it's in a fixed position, it's a bottom-right aligned popup.
				$(currentDrag).css(is_fixed ? {
					right: currentPos.X - e.pageX + origMouse.X,
					bottom: currentPos.Y - e.pageY + origMouse.Y
				} : {
					left: currentPos.X + e.pageX - origMouse.X,
					top: currentPos.Y + e.pageY - origMouse.Y
				});
				return false;
			}
		})
		.mouseup(function () {
			if (currentDrag)
				return !!(currentDrag = 0);
		});
})(jQuery);


/*!
 * Dropdown menu in JS with CSS fallback, Wedge style.
 * It may not show, but it took me years to refine it. -- Nao
 */
var menu_baseId = hoverable = 0, menu_delay = [], menu_ieshim = [], hove = 'hove';

function initMenu(menu)
{
	menu = $('#' + menu).show().css('visibility', 'visible');
	menu[0].style.opacity = 1;
	$('h4:not(:has(a))', menu).wrapInner('<a href="#" onclick="hoverable = 1; menu_show_me.call(this.parentNode.parentNode); hoverable = 0; return false;"></a>');

	var k = menu_baseId;
	$('li', menu).each(function () {
		if (is_ie6)
		{
			$(this).keyup(menu_show_me);
			document.write('<iframe src="" id="shim' + k + '" class="iefs" frameborder="0" scrolling="no"></iframe>');
			menu_ieshim[k] = $('#shim' + k)[0];
		}
		$(this).attr('id', 'li' + k++)
			.bind('mouseenter focus', menu_show_me)
			.bind('mouseleave blur', menu_hide_me)
			.mousedown(false)
			.click(function () {
				$('.' + hove).removeClass(hove);
				$('ul', menu).css(is_ie8down ? { visibility: 'hidden' } : { visibility: 'hidden', opacity: 0 });
				if (is_ie6)
					$('li', menu).each(function () { menu_show_shim(false, this.id); });
			});
	});
	menu_baseId = k;

	// Now that JS is ready to take action... Disable the pure CSS menu!
	$('.css.menu').removeClass('css');
}

// Without this, IE6 would show form elements in front of the menu. Bad IE6.
function menu_show_shim(showsh, ieid, j)
{
	var iem = ieid.substring(2);
	if (!menu_ieshim[iem])
		return;

	$(menu_ieshim[iem]).css(showsh ?
		{
			top: j.offsetTop + j.offsetParent.offsetTop,
			left: j.offsetLeft + j.offsetParent.offsetLeft,
			width: j.offsetWidth + 1,
			height: j.offsetHeight + 1,
			display: 'block'
		} : {
			display: 'none'
		}
	);
}

// Entering a menu entry?
function menu_show_me()
{
	var
		hasul = $('ul', this)[0], style = hasul ? hasul.style : {}, is_visible = style.visibility == 'visible',
		id = this.id, parent = this.parentNode, is_top = parent.className == 'menu', d = document.dir;

	if (hoverable && is_visible)
		return menu_hide_children(id);

	if (hasul)
	{
		style.visibility = 'visible';
		style.opacity = 1;
		style['margin' + (d && d == 'rtl' ? 'Right' : 'Left')] = (is_top ? parseInt($('span', this).css('width'), 10) : parent.clientWidth - 5) + 'px';
		if (is_ie6)
			menu_show_shim(true, id, hasul);
	}

	if (!is_top || !$('h4', this).first().addClass(hove).length)
		$(this).addClass(hove).parentsUntil('.menu>li').each(function () {
			if (this.nodeName == 'LI')
				$(this).addClass(hove);
		});

	if (!is_visible)
		$('ul', this).first()
			.css(is_top ? { marginTop: is_ie6 || is_ie7 ? 6 : 33 } : { marginLeft: parent.clientWidth })
			.animate(is_top ? { marginTop: is_ie6 || is_ie7 ? 0 : 27 } : { marginLeft: parent.clientWidth - 5 }, 'fast');

	clearTimeout(menu_delay[id.substring(2)]);

	$(this).siblings('li').each(function () { menu_hide_children(this.id); });
}

// Leaving a menu entry?
function menu_hide_me(e)
{
	// The deepest level should hide the hover class immediately.
	if (!$(this).children('ul').length)
		$(this).children().andSelf().removeClass(hove);

	// Are we leaving the menu entirely, and thus triggering the time
	// threshold, or are we just switching to another menu item?
	var id = this.id;
	$(e.relatedTarget).parents('.menu').length ?
		menu_hide_children(id) :
		menu_delay[id.substring(2)] = setTimeout(function () { menu_hide_children(id); }, 250);
}

// Hide all children menus.
function menu_hide_children(id)
{
	$('#' + id).children().andSelf().removeClass(hove).find('ul')
		.css(is_ie8down ? { visibility: 'hidden' } : { visibility: 'hidden', opacity: 0 });

	if (is_ie6)
		menu_show_shim(false, id);
}


// This'll contain all JumpTo objects on the page.
var aJumpTo = [];

// This function will retrieve the contents needed for the jump to boxes.
function grabJumpToContent()
{
	var aBoardsAndCategories = [], i, n;

	ajax_indicator(true);

	$('we item', getXMLDocument(we_prepareScriptUrl() + 'action=ajax;sa=jumpto;xml').responseXML).each(function () {
		aBoardsAndCategories.push({
			id: parseInt(this.getAttribute('id'), 10),
			isCategory: this.getAttribute('type') == 'category',
			name: $(this).text().removeEntities(),
			url: this.getAttribute('url'),
			level: parseInt(this.getAttribute('level'), 10)
		});
	});

	ajax_indicator(false);

	for (i = 0, n = aJumpTo.length; i < n; i++)
		aJumpTo[i]._fillSelect(aBoardsAndCategories);
}

// *** JumpTo class.
function JumpTo(opt)
{
	this.opt = opt;
	var sContainer = opt.sContainerId;

	$('#' + sContainer).html(opt.sJumpToTemplate
		.replace('%select_id%', sContainer + '_select')
		.replace('%dropdown_list%', '<select name="' + sContainer + '_select" id="' + sContainer + '_select"><option>=> ' + opt.sPlaceholder + '</option></select>'))
		.find('select').focus(grabJumpToContent);
};

// Fill the jump to box with entries. Method of the JumpTo class.
JumpTo.prototype._fillSelect = function (aBoardsAndCategories)
{
	var
		sList = '', i, n, sChildLevelPrefix, isCategory, $val,
		oDashOption = '<option disabled>------------------------------</option>',
		$dropdownList = $('#' + this.opt.sContainerId + '_select').unbind('focus');

	// Loop through all items to be added.
	for (i = 0, n = aBoardsAndCategories.length; i < n; i++)
	{
		isCategory = aBoardsAndCategories[i].isCategory;

		if (isCategory)
			sList += oDashOption;
		else
			sChildLevelPrefix = new Array(aBoardsAndCategories[i].level + 1).join('==');

		// Show the board/category option, with special treatment for the current one.
		sList += '<option value="' + (isCategory ? '#c' + aBoardsAndCategories[i].id : aBoardsAndCategories[i].url) + '"' +
				(!isCategory && aBoardsAndCategories[i].id == this.opt.iBoardId ? ' style="background: #d0f5d5">=> ' + aBoardsAndCategories[i].name + ' &lt;='
				: '>' + (isCategory ? '' : sChildLevelPrefix + '=> ') + aBoardsAndCategories[i].name) + '</option>';

		if (isCategory)
			sList += oDashOption;
	}

	// Add the remaining items after the currently selected item.
	$dropdownList.append(sList).change(function () {
		if (this.selectedIndex > 0 && ($val = $(this).val()))
			window.location.href = $val.indexOf('://') > -1 ? $val : we_script.replace(/\?.*/g, '') + $val;
	});
};


/*
// This will add an extra class to any external links, except those with title="-".
// Ignored for now because it needs some improvement to the domain name detection.
function _linkMagic()
{
	$('a[title!="-"]').each(function () {
		var hre = $(this).attr('href');
		if (typeof hre == 'string' && hre.length > 0 && (hre.indexOf(window.location.hostname) == -1) && (hre.indexOf('://') != -1))
			$(this).addClass('xt');
	});
}
*/

function _testStyle(sty)
{
	var uc = sty.charAt(0).toUpperCase() + sty.substr(1), stys = [ sty, 'Moz'+uc, 'Webkit'+uc, 'Khtml'+uc, 'ms'+uc, 'O'+uc ], i;
	for (i in stys) if (_w.style[stys[i]] !== undefined) return true;
	return false;
}

// Has your browser got the goods?
// These variables aren't used, but you can now use them in your custom scripts.
// In short: if (!can_borderradius) inject_rounded_border_emulation_hack();
var
	_w = document.createElement('wedgerocks'),
	can_borderradius = _testStyle('borderRadius'),
	can_boxshadow = _testStyle('boxShadow'),
	can_ajax = $.support.ajax;

/* Optimize:
menu_baseId = _b
_cookie = _c
menu_delay = _d
_formSubmitted = _f
menu_hide_children = _h
menu_hide_me = _hm
menu_ieshim = _ie
_lastKeepAliveCheck = _k
_collapsed = _o
menu_show_me = _sm
menu_show_shim = _sh
_fillSelect = _fs
_changeState = _cs
grabJumpToContent = gjtc
*/
