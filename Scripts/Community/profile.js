

/* returns a jquery deferred object, .done() means an invite was sent (or attempted), .fail() indicates they dismissed the modal */
function PresentGroupInviteOptions( rgFriendsToInvite )
{
	// this deferred will succeed if an invite is succesfully sent, fail if the user dismisses the modal or the invite AJAX fails
	var deferred = new jQuery.Deferred();

	var Modal = ShowDialog( 'Invite to join your group', '<div class="group_invite_throbber"><img src="https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif"></div>' );
	var $ListElement = $J('<div/>', {'class': 'newmodal_content_innerbg'} );

	var bBulkFriendInvite = false;
	var steamIDInvitee = g_rgProfileData['steamid'];
	var strProfileURL = g_rgProfileData['url'];

	// see if this is a request to bulk invite a group of friends
	if ( rgFriendsToInvite && rgFriendsToInvite instanceof Array )
	{
		if ( rgFriendsToInvite.length == 1 )
		{
			steamIDInvitee = rgFriendsToInvite[0];
			strProfileURL = 'https://steamcommunity.com/profiles/' + steamIDInvitee + '/';
		}
		else
		{
			// true bulk invite
			steamIDInvitee = rgFriendsToInvite;
			bBulkFriendInvite = true;
		}
	}

	// if the modal is dismissed , we'll cancel the deferred object.  We capture this in a closure so that we can dismiss the modal without affecting
	//	the deferred object if the user actually picks something (in which case the deferred object will be the success of the AJAX invite action)
	var fnOnModalDismiss = function() { deferred.reject() };

	$J.get( strProfileURL + 'ajaxgroupinvite?new_profile=1' + ( bBulkFriendInvite ? '&bulk=1' : '' ), function( html ) {
		Modal.GetContent().find( '.newmodal_content').html('');	// erase the throbber
		Modal.GetContent().find( '.newmodal_content').append( $ListElement );
		$ListElement.html( html );
		Modal.AdjustSizing();
		$ListElement.children( '.group_list_results' ).children().each( function () {
			var groupid = this.getAttribute( 'data-groupid' );
			if ( groupid )
			{
				$J(this).click( function() {
					fnOnModalDismiss = function() {;};	// don't resolve the deferred on modal dismiss anymore, user has picked something
					InviteUserToGroup( Modal, groupid, steamIDInvitee)
					.done( function() { deferred.resolve(); } )
					.fail( function() { deferred.reject(); } );
				} );
			}
		});
	});

	Modal.done( function() {fnOnModalDismiss();} );

	return deferred.promise();
}

function InviteUserToGroup( Modal, groupID, steamIDInvitee )
{
	var params = {
		json: 1,
		type: 'groupInvite',
		group: groupID,
		sessionID: g_sessionID
	};

	if ( steamIDInvitee instanceof Array )
		params.invitee_list = V_ToJSON( steamIDInvitee );
	else
		params.invitee = steamIDInvitee;

	return $J.ajax( { url: 'https://steamcommunity.com/actions/GroupInvite',
		data: params,
		type: 'POST'
	} ).done( function( data ) {
		Modal && Modal.Dismiss();
		var strMessage = 'Invitation Sent!';
		if ( data.duplicate )
		{
			strMessage += '<br>Some invites were not sent because the recipients are already in the group or have already received invites.';
		}
		ShowAlertDialog( 'Invite to join your group', strMessage );

	}).fail( function( data ) {
		Modal && Modal.Dismiss();
		ShowAlertDialog( '', data.results ? data.results : 'Error processing your request. Please try again.' );
	});
}

function RemoveFriend()
{
	var steamid = g_rgProfileData['steamid'];
	var strPersonaName = g_rgProfileData['personaname'];

	ShowConfirmDialog( 'Remove friend',
		'Are you sure you want to remove %s from your friend list?'.replace( /%s/, strPersonaName ),
		'Remove friend'
	).done( function() {
		$J.post(
			'https://steamcommunity.com/actions/RemoveFriendAjax',
			{sessionID: g_sessionID, steamid: steamid }
		).done( function() {
			ShowAlertDialog( 'Remove friend',
				'%s has been removed from your friends list.'.replace( /%s/, strPersonaName )
			).done( function() {
				// reload the page when they click OK, so we update friend state
				window.location.reload();
			} );
		} ).fail( function() {
			ShowAlertDialog( 'Remove friend',
				'Error processing your request. Please try again.'
			);
		} );
	} );
}

// also used for accepting friend invites
function AddFriend( bRespondingToInvite, steamid_friend, strPersonaName_friend )
{
	var steamid = steamid_friend ? steamid_friend : g_rgProfileData['steamid'];
	var strPersonaName = strPersonaName_friend ? strPersonaName_friend : g_rgProfileData['personaname'];

	$J.post(
		'https://steamcommunity.com/actions/AddFriendAjax',
		{sessionID: g_sessionID, steamid: steamid, accept_invite: bRespondingToInvite ? 1 : 0 }
	).done( function() {
		if ( !bRespondingToInvite )
		{
			ShowAlertDialog( 'Add Friend' + ' - ' + strPersonaName,
				'Friend invite sent. They will appear as a friend once they have accepted your invite.'
			);
		}
		else
		{
			ShowAlertDialog( 'Accept Friend Request',
				'Friend request accepted'
			).done( function() { window.location.reload(); } );
		}
	} ).fail( function() {
		ShowAlertDialog( 'Add Friend',
			'Error adding friend. Please try again.'
		);
	} );
}

// ignore an invite; do not block the inviter
function IgnoreFriendInvite( steamid_friend, strPersonaName_friend )
{
	var steamid = steamid_friend ? steamid_friend : g_rgProfileData['steamid'];
	var strPersonaName = strPersonaName_friend ? strPersonaName_friend : g_rgProfileData['personaname'];

	$J.post(
		'https://steamcommunity.com/actions/IgnoreFriendInviteAjax',
		{sessionID: g_sessionID, steamid: steamid }
	).done( function() {
		ShowAlertDialog( 'Ignore Friend Request',
			'Friend request ignored'
		).done( function() { window.location.reload(); } );
	} ).fail( function() {
		ShowAlertDialog( 'Ignore Friend Request',
			'Error ignoring friend request. Please try again.'
		);
	} );
}

// block a user, with confirmation
function ConfirmBlock()
{
	var steamid = g_rgProfileData['steamid'];
	var strPersonaName = g_rgProfileData['personaname'];

	ShowConfirmDialog( 'Block all communication',
		'You are about to block all communication with %s.'.replace( /%s/, strPersonaName ),
		'Yes, block them'
	).done( function() {
			$J.post(
				'https://steamcommunity.com/actions/BlockUserAjax',
				{sessionID: g_sessionID, steamid: steamid }
			).done( function() {
				ShowAlertDialog( 'Block all communication',
					'You have blocked all communications with this player.'
				);
			} ).fail( function() {
				ShowAlertDialog( 'Block all communication',
					'Error processing your request. Please try again.'
				);
			} );
		} );
}

function InitProfileSummary( strSummary )
{
	var $Summary = $J( '.profile_summary' );
	var $SummaryFooter = $J( '.profile_summary_footer' );

	if ( $Summary[0].scrollHeight <= 76 )
	{
		$Summary.css( 'height', 76 );
		$SummaryFooter.hide();
	}
	else
	{
		var $ModalSummary = $J('<div/>', {'class': 'profile_summary_modal'}).html( strSummary );
		if ( window.BindAllEmoticonHovers )
			BindAllEmoticonHovers( $ModalSummary );
		$SummaryFooter.find( 'span' ).click( function() {
			var Modal = ShowDialog( 'Info', $ModalSummary );
			window.setTimeout( function() { Modal.AdjustSizing(); }, 1 );
		} );
	}

}

function ShowFriendsInCommon( unAccountIDTarget )
{
	ShowPlayerList( 'Friends in Common', 'friendsincommon', unAccountIDTarget );
}

function ShowFriendsInGroup( unClanIDTarget )
{
	ShowPlayerList( 'Friends in Group', 'friendsingroup', unClanIDTarget );
}

function ShowPlayerList( title, type, unAccountIDTarget, rgAccountIDs )
{
	var Modal = ShowAlertDialog( title, '<div class="group_invite_throbber"><img src="https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif"></div>' );
	var $ListElement = $J('<div/>', {'class': 'player_list_ctn'} );
	var $Buttons = Modal.GetContent().find('.newmodal_buttons').detach();

	Modal.GetContent().css( 'min-width', 268 );

	var rgParams = {};
	if ( type )
		rgParams['type'] = type;
	if ( unAccountIDTarget )
		rgParams['target'] = unAccountIDTarget;
	if ( rgAccountIDs )
		rgParams['accountids'] = rgAccountIDs.join( ',' );

	$J.get( 'https://steamcommunity.com/actions/PlayerList/', rgParams, function( html ) {

		$ListElement.html( html );

		var $Content = Modal.GetContent().find( '.newmodal_content');
		$Content.html(''); // erase the throbber
		$Content.append( $ListElement );
		$Content.append( $Buttons );

		Modal.AdjustSizing();
		$ListElement.append();
	});
}

function ToggleManageFriends()
{
	if ( $J('#manage_friends_actions_ctn').is( ':hidden' ) )
	{
		$J('#manage_friends_btn').find( '.btn_details_arrow').removeClass( 'down').addClass( 'up' );
		$J('#manage_friends_actions_ctn').slideDown( 'fast' );
		$J('div.manage_friend_checkbox').show();
	}
	else
	{
		$J('#manage_friends_btn').find( '.btn_details_arrow').removeClass( 'up').addClass( 'down' );
		$J('#manage_friends_actions_ctn').slideUp( 'fast' );
		$J('div.manage_friend_checkbox').hide();
	}
}

function ManageFriendsInviteToGroup( $Form, groupid )
{
	$Form.find('input[type="checkbox"]')
	var rgFriendSteamIDs = [];
	$Form.find( 'input[type=checkbox]' ).each( function() {
		if ( this.checked )
			rgFriendSteamIDs.push( $J(this).attr( 'data-steamid' ) );
	} );
	if ( rgFriendSteamIDs.length > 0 )
	{
		if ( groupid )
		{
			// specific group
			InviteUserToGroup( null /* no modal window */, groupid, rgFriendSteamIDs ).done( function() {
				$Form.find('input[type=checkbox]').prop( 'checked', false );
			});
		}
		else
		{
			// ask the user which group to invite to
			PresentGroupInviteOptions( rgFriendSteamIDs).done( function() {
				$Form.find('input[type=checkbox]').prop( 'checked', false );
			});
		}
	}
	else
	{
		ShowAlertDialog( 'Invite to join your group', 'You have not selected any friends.' );
	}
}

function ManageFriendsExecuteBulkAction( $Form, strActionName )
{
	if ( $Form.find('input[type=checkbox]:checked').length == 0 )
	{
		ShowAlertDialog( '', 'You have not selected any friends.' );
		return;
	}

	$Form.find('input[name=action]').val( strActionName );
	$Form.submit();
}

function ManageFriendsConfirmBulkAction( $Form, strActionName, strTitle, strSingluarDescription, strPluralDescription )
{
	var cFriendsSelected = $Form.find('input[type=checkbox]:checked').length;
	if ( cFriendsSelected == 0 )
	{
		ShowAlertDialog( strTitle, 'You have not selected any friends.' );
		return;
	}

	var strDescription = strSingluarDescription;
	if ( cFriendsSelected != 1 )
		strDescription = strPluralDescription.replace( /%s/, cFriendsSelected );

	ShowConfirmDialog( strTitle, strDescription).done( function() {
		ManageFriendsExecuteBulkAction( $Form, strActionName );
	});
}

function ManageFriendsBlock( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'ignore', 'Block',
		'Are you sure you want to block this friend?' + ' ' + 'You will no longer be able to send or receive messages or invites with this player.',
		'Are you sure you want to block these %s friends?' + ' ' + 'You will no longer be able to send or receive messages or invites with these players.');
}

function ManageFriendsRemove( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'remove', 'Remove Friend',
		'Are you sure you want to remove this friend?' + ' ' + 'This player will no longer appear in your friends list and you will not be able to communicate with them.',
		'Are you sure you want to remove these %s friends?' + ' ' + 'These players will no longer appear in your friends list and you will not be able to communicate with them.');
}




var AliasesLoaded = false;
function ShowAliasPopup(e)
{
	ShowMenu( e, 'NamePopup', 'left' );

	if( AliasesLoaded )
		return true;

	var aliasContainer = $( 'NamePopupAliases' );

	var throbber = document.createElement( 'img' );
	throbber.src = 'https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif';
	aliasContainer.appendChild( throbber );

	new Ajax.Request( g_rgProfileData['url'] + 'ajaxaliases/', {
		method: 'post',
		parameters: { },
		onSuccess: function( transport ) {

			var Aliases = transport.responseJSON;

			if( !aliasContainer )
				return;

			aliasContainer.update('');

			if( !Aliases || Aliases.length == 0 )
				Aliases.push( {newname: "This user has no known aliases"} );

			for( var x=0; x<Aliases.length; x++ )
			{
				var c = Aliases[x];

				var curSpan = document.createElement( 'p' );
				var curATN = document.createTextNode( c['newname'] );
				curSpan.appendChild( curATN );
				aliasContainer.appendChild( curSpan );
			}

			AliasesLoaded = true;
		},
		onFailure: function( transport ) { alert( 'Please try again later' ); }
	} );
}


function ShowFriendSelect( title, fnOnSelect )
{
	var Modal = ShowAlertDialog( title, '<div class="group_invite_throbber"><img src="https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif"></div>', 'Cancel' );
	var $ListElement = $J('<div/>', {'class': 'player_list_ctn'} );
	var $Buttons = Modal.GetContent().find('.newmodal_buttons').detach();

	Modal.GetContent().css( 'min-width', 268 );

	var rgParams = {type: 'friends'};

	$J.get( 'https://steamcommunity.com/actions/PlayerList/', rgParams, function( html ) {

		$ListElement.html( html );

		$ListElement.find( 'a' ).remove();
		$ListElement.find( '[data-miniprofile]').each( function() {
			var $El = $J(this);
			$El.click( function() {  Modal.Dismiss(); fnOnSelect( $El.data('miniprofile') ); } );
		} );

		var $Content = Modal.GetContent().find( '.newmodal_content');
		$Content.html(''); // erase the throbber
		$Content.append( $ListElement );
		$Content.append( $Buttons );

		Modal.AdjustSizing();
	});
}

function StartTradeOffer( unAccountID, rgParams )
{
	var params = rgParams || {};
	params['partner'] = unAccountID;
	ShowTradeOffer( 'new', params );
}

function CancelTradeOffer( tradeOfferID )
{
	ShowConfirmDialog(
		'Cancel Trade Offer',
		'Are you sure you want to cancel this trade offer?',
		'Yes',
		'No'
	).done( function() {
		ActOnTradeOffer( tradeOfferID, 'cancel', 'Trade Offer Canceled', 'Cancel Trade Offer' );
	} );
}

function DeclineTradeOffer( tradeOfferID )
{
	ShowConfirmDialog(
		'Decline Trade',
		'Are you sure you want to decline this trade offer?  You can also modify the items and send a counter offer.',
		'Decline Trade',
		null,
		'Make a Counter Offer'
	).done( function( strButton ) {
		if ( strButton == 'OK' )
			ActOnTradeOffer( tradeOfferID, 'decline', 'Trade Declined', 'Decline Trade' );
		else
			ShowTradeOffer( tradeOfferID, {counteroffer: 1} );
	} );
}

function ActOnTradeOffer( tradeOfferID, strAction, strCompletedBanner, strActionDisplayName )
{
	var $TradeOffer = $J('#tradeofferid_' + tradeOfferID);
	$TradeOffer.find( '.tradeoffer_footer_actions').hide();

	return $J.ajax( {
		url: 'https://steamcommunity.com/tradeoffer/' + tradeOfferID + '/' + strAction,
		data: { sessionid: g_sessionID },
		type: 'POST',
		crossDomain: true,
		xhrFields: { withCredentials: true }
	}).done( function( data ) {
		AddTradeOfferBanner( tradeOfferID, strCompletedBanner, false );

		RefreshNotificationArea();
	}).fail( function() {
		ShowAlertDialog( strActionDisplayName, 'There was an error modifying this trade offer.  Please try again later.' );
		$TradeOffer.find( '.tradeoffer_footer_actions').show();
	});
}

function AddTradeOfferBanner( tradeOfferID, strCompletedBanner, bAccepted )
{
	var $TradeOffer = $J('#tradeofferid_' + tradeOfferID);
	$TradeOffer.find( '.tradeoffer_footer_actions').hide();
	$TradeOffer.find( '.link_overlay' ).hide();
	$TradeOffer.find( '.tradeoffer_items_ctn').removeClass( 'active' ).addClass( 'inactive' );

	var $Banner = $J('<div/>', {'class': 'tradeoffer_items_banner' } );
	if ( bAccepted )
		$Banner.addClass( 'accepted' );

	$Banner.text( strCompletedBanner );
	$TradeOffer.find( '.tradeoffer_items_rule').replaceWith( $Banner );
}

