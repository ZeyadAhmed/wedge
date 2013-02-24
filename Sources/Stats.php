<?php
/**
 * Wedge
 *
 * Gathers the statistics from the entire forum.
 *
 * @package wedge
 * @copyright 2010-2013 Wedgeward, wedge.org
 * @license http://wedge.org/license/
 *
 * @version 0.1
 */

if (!defined('WEDGE'))
	die('Hacking attempt...');

/*	This function has only one job: providing a display for forum statistics.
	As such, it has only one function:

	void Stats()
		- gets all the statistics in order and puts them in.
		- uses the Stats template and language file. (and main block.)
		- requires the view_stats permission.
		- accessed from ?action=stats.

	void getDailyStats(string $condition)
		- called by DisplayStats().
		- loads the statistics on a daily basis in $context.

*/

// Display some useful/interesting board statistics.
function Stats()
{
	global $txt, $scripturl, $settings, $context;

	isAllowedTo('view_stats');

	if (!empty($_REQUEST['expand']))
	{
		$context['robot_no_index'] = true;

		$month = (int) substr($_REQUEST['expand'], 4);
		$year = (int) substr($_REQUEST['expand'], 0, 4);
		if ($year > 1900 && $year < 2200 && $month >= 1 && $month <= 12)
			$_SESSION['expanded_stats'][$year][] = $month;
	}
	elseif (!empty($_REQUEST['collapse']))
	{
		$context['robot_no_index'] = true;

		$month = (int) substr($_REQUEST['collapse'], 4);
		$year = (int) substr($_REQUEST['collapse'], 0, 4);
		if (!empty($_SESSION['expanded_stats'][$year]))
			$_SESSION['expanded_stats'][$year] = array_diff($_SESSION['expanded_stats'][$year], array($month));
	}

	// Handle the Ajax request.
	if (AJAX)
	{
		// Collapsing stats only needs adjustments of the session variables.
		if (!empty($_REQUEST['collapse']))
			obExit(false);

		wetem::load('stats');
		getDailyStats('YEAR(date) = {int:year} AND MONTH(date) = {int:month}', array('year' => $year, 'month' => $month));
		$context['yearly'][$year]['months'][$month]['date'] = array(
			'month' => sprintf('%02d', $month),
			'year' => $year,
		);
		return;
	}

	loadLanguage('Stats');
	loadTemplate('Stats');

	if (empty($settings['trackStats']))
		fatal_lang_error('stats_not_available', false);

	// Build the link tree......
	$context['linktree'][] = array(
		'url' => $scripturl . '?action=stats',
		'name' => $txt['stats_center']
	);
	$context['page_title'] = $context['forum_name'] . ' - ' . $txt['stats_center'];

	$context['show_member_list'] = allowedTo('view_mlist');

	// Get averages...
	$result = wesql::query('
		SELECT
			SUM(posts) AS posts, SUM(topics) AS topics, SUM(registers) AS registers,
			SUM(most_on) AS most_on, MIN(date) AS date, SUM(hits) AS hits
		FROM {db_prefix}log_activity',
		array(
		)
	);
	$row = wesql::fetch_assoc($result);
	wesql::free_result($result);

	// This would be the amount of time the forum has been up... in days...
	$total_days_up = ceil((time() - strtotime($row['date'])) / (60 * 60 * 24));

	$context['average_posts'] = comma_format(round($row['posts'] / $total_days_up, 2));
	$context['average_topics'] = comma_format(round($row['topics'] / $total_days_up, 2));
	$context['average_members'] = comma_format(round($row['registers'] / $total_days_up, 2));
	$context['average_online'] = comma_format(round($row['most_on'] / $total_days_up, 2));
	$context['average_hits'] = comma_format(round($row['hits'] / $total_days_up, 2));

	$context['num_hits'] = comma_format($row['hits'], 0);

	// How many users are online now.
	$result = wesql::query('
		SELECT COUNT(*)
		FROM {db_prefix}log_online',
		array(
		)
	);
	list ($context['users_online']) = wesql::fetch_row($result);
	wesql::free_result($result);

	// Statistics such as number of boards, categories, etc.
	$result = wesql::query('
		SELECT COUNT(*)
		FROM {db_prefix}boards AS b
		WHERE b.redirect = {string:blank_redirect}',
		array(
			'blank_redirect' => '',
		)
	);
	list ($context['num_boards']) = wesql::fetch_row($result);
	wesql::free_result($result);

	$result = wesql::query('
		SELECT COUNT(*)
		FROM {db_prefix}categories AS c',
		array(
		)
	);
	list ($context['num_categories']) = wesql::fetch_row($result);
	wesql::free_result($result);

	// Format the numbers nicely.
	$context['users_online'] = comma_format($context['users_online']);
	$context['num_boards'] = comma_format($context['num_boards']);
	$context['num_categories'] = comma_format($context['num_categories']);

	$context['num_members'] = comma_format($settings['totalMembers']);
	$context['num_posts'] = comma_format($settings['totalMessages']);
	$context['num_topics'] = comma_format($settings['totalTopics']);
	$context['most_members_online'] = array(
		'number' => comma_format($settings['mostOnline']),
		'date' => timeformat($settings['mostDate'])
	);
	$context['latest_member'] =& $context['common_stats']['latest_member'];

	// Male vs. female ratio - let's calculate this only every four minutes.
	if (($context['gender'] = cache_get_data('stats_gender', 240)) == null)
	{
		$result = wesql::query('
			SELECT COUNT(*) AS total_members, gender
			FROM {db_prefix}members
			GROUP BY gender',
			array(
			)
		);
		$context['gender'] = array();
		while ($row = wesql::fetch_assoc($result))
		{
			// Assuming we're telling... male or female?
			if (!empty($row['gender']))
				$context['gender'][$row['gender'] == 2 ? 'females' : 'males'] = $row['total_members'];
		}
		wesql::free_result($result);

		// Set these two zero if the didn't get set at all.
		if (empty($context['gender']['males']))
			$context['gender']['males'] = 0;
		if (empty($context['gender']['females']))
			$context['gender']['females'] = 0;

		// Try and come up with some "sensible" default states in case of a non-mixed board.
		if ($context['gender']['males'] == $context['gender']['females'])
			$context['gender']['ratio'] = '1:1';
		elseif ($context['gender']['males'] == 0)
			$context['gender']['ratio'] = '0:1';
		elseif ($context['gender']['females'] == 0)
			$context['gender']['ratio'] = '1:0';
		elseif ($context['gender']['males'] > $context['gender']['females'])
			$context['gender']['ratio'] = round($context['gender']['males'] / $context['gender']['females'], 1) . ':1';
		elseif ($context['gender']['females'] > $context['gender']['males'])
			$context['gender']['ratio'] = '1:' . round($context['gender']['females'] / $context['gender']['males'], 1);

		cache_put_data('stats_gender', $context['gender'], 240);
	}

	$date = strftime('%Y-%m-%d', forum_time(false));

	// Members online so far today.
	$result = wesql::query('
		SELECT most_on
		FROM {db_prefix}log_activity
		WHERE date = {date:today_date}
		LIMIT 1',
		array(
			'today_date' => $date,
		)
	);
	list ($context['online_today']) = wesql::fetch_row($result);
	wesql::free_result($result);

	$context['online_today'] = comma_format((int) $context['online_today']);

	// Poster top 10.
	$members_result = wesql::query('
		SELECT id_member, real_name, posts
		FROM {db_prefix}members
		WHERE posts > {int:no_posts}
		ORDER BY posts DESC
		LIMIT 10',
		array(
			'no_posts' => 0,
		)
	);
	$context['top_posters'] = array();
	$max_num_posts = 1;
	while ($row_members = wesql::fetch_assoc($members_result))
	{
		$context['top_posters'][] = array(
			'name' => $row_members['real_name'],
			'id' => $row_members['id_member'],
			'num_posts' => $row_members['posts'],
			'href' => $scripturl . '?action=profile;u=' . $row_members['id_member'],
			'link' => '<a href="' . $scripturl . '?action=profile;u=' . $row_members['id_member'] . '">' . $row_members['real_name'] . '</a>'
		);

		$max_num_posts = max($max_num_posts, $row_members['posts']);
	}
	wesql::free_result($members_result);

	foreach ($context['top_posters'] as $i => $poster)
	{
		$context['top_posters'][$i]['post_percent'] = round(($poster['num_posts'] * 100) / $max_num_posts);
		$context['top_posters'][$i]['num_posts'] = comma_format($context['top_posters'][$i]['num_posts']);
	}

	// Board top 10.
	$boards_result = wesql::query('
		SELECT id_board, name, num_posts
		FROM {db_prefix}boards AS b
		WHERE {query_see_board}' . (!empty($settings['recycle_enable']) && $settings['recycle_board'] > 0 ? '
			AND b.id_board != {int:recycle_board}' : '') . '
			AND b.redirect = {string:blank_redirect}
		ORDER BY num_posts DESC
		LIMIT 10',
		array(
			'recycle_board' => $settings['recycle_board'],
			'blank_redirect' => '',
		)
	);
	$context['top_boards'] = array();
	$max_num_posts = 1;
	while ($row_board = wesql::fetch_assoc($boards_result))
	{
		$context['top_boards'][] = array(
			'id' => $row_board['id_board'],
			'name' => $row_board['name'],
			'num_posts' => $row_board['num_posts'],
			'href' => $scripturl . '?board=' . $row_board['id_board'] . '.0',
			'link' => '<a href="' . $scripturl . '?board=' . $row_board['id_board'] . '.0">' . $row_board['name'] . '</a>'
		);

		$max_num_posts = max($max_num_posts, $row_board['num_posts']);
	}
	wesql::free_result($boards_result);

	foreach ($context['top_boards'] as $i => $board)
	{
		$context['top_boards'][$i]['post_percent'] = round(($board['num_posts'] * 100) / $max_num_posts);
		$context['top_boards'][$i]['num_posts'] = comma_format($context['top_boards'][$i]['num_posts']);
	}

	// Are you on a larger forum?  If so, let's try to limit the number of topics we search through.
	if ($settings['totalMessages'] > 100000)
	{
		$request = wesql::query('
			SELECT id_topic
			FROM {db_prefix}topics AS t
			WHERE num_replies != {int:no_replies}
				AND {query_see_topic}
			ORDER BY num_replies DESC
			LIMIT 100',
			array(
				'no_replies' => 0,
			)
		);
		$topic_ids = array();
		while ($row = wesql::fetch_assoc($request))
			$topic_ids[] = $row['id_topic'];
		wesql::free_result($request);
	}
	else
		$topic_ids = array();

	// Topic replies top 10.
	$topic_reply_result = wesql::query('
		SELECT m.subject, t.num_replies, t.id_board, t.id_topic, b.name
		FROM {db_prefix}topics AS t
			INNER JOIN {db_prefix}messages AS m ON (m.id_msg = t.id_first_msg)
			INNER JOIN {db_prefix}boards AS b ON (b.id_board = t.id_board' . (!empty($settings['recycle_enable']) && $settings['recycle_board'] > 0 ? '
			AND b.id_board != {int:recycle_board}' : '') . ')
		WHERE {query_see_board}' . (!empty($topic_ids) ? '
			AND t.id_topic IN ({array_int:topic_list})' : '
			AND {query_see_topic}') . '
		ORDER BY t.num_replies DESC
		LIMIT 10',
		array(
			'topic_list' => $topic_ids,
			'recycle_board' => $settings['recycle_board'],
		)
	);
	$context['top_topics_replies'] = array();
	$max_num_replies = 1;
	while ($row_topic_reply = wesql::fetch_assoc($topic_reply_result))
	{
		censorText($row_topic_reply['subject']);

		$context['top_topics_replies'][] = array(
			'id' => $row_topic_reply['id_topic'],
			'board' => array(
				'id' => $row_topic_reply['id_board'],
				'name' => $row_topic_reply['name'],
				'href' => $scripturl . '?board=' . $row_topic_reply['id_board'] . '.0',
				'link' => '<a href="' . $scripturl . '?board=' . $row_topic_reply['id_board'] . '.0">' . $row_topic_reply['name'] . '</a>'
			),
			'subject' => $row_topic_reply['subject'],
			'num_replies' => $row_topic_reply['num_replies'],
			'href' => $scripturl . '?topic=' . $row_topic_reply['id_topic'] . '.0',
			'link' => '<a href="' . $scripturl . '?topic=' . $row_topic_reply['id_topic'] . '.0">' . $row_topic_reply['subject'] . '</a>'
		);

		$max_num_replies = max($max_num_replies, $row_topic_reply['num_replies']);
	}
	wesql::free_result($topic_reply_result);

	foreach ($context['top_topics_replies'] as $i => $topic)
	{
		$context['top_topics_replies'][$i]['post_percent'] = round(($topic['num_replies'] * 100) / $max_num_replies);
		$context['top_topics_replies'][$i]['num_replies'] = comma_format($context['top_topics_replies'][$i]['num_replies']);
	}

	// Large forums may need a bit more prodding...
	if ($settings['totalMessages'] > 100000)
	{
		$request = wesql::query('
			SELECT id_topic
			FROM {db_prefix}topics
			WHERE num_views != {int:no_views}
			ORDER BY num_views DESC
			LIMIT 100',
			array(
				'no_views' => 0,
			)
		);
		$topic_ids = array();
		while ($row = wesql::fetch_assoc($request))
			$topic_ids[] = $row['id_topic'];
		wesql::free_result($request);
	}
	else
		$topic_ids = array();

	// Topic views top 10.
	$topic_view_result = wesql::query('
		SELECT m.subject, t.num_views, t.id_board, t.id_topic, b.name
		FROM {db_prefix}topics AS t
			INNER JOIN {db_prefix}messages AS m ON (m.id_msg = t.id_first_msg)
			INNER JOIN {db_prefix}boards AS b ON (b.id_board = t.id_board' . (!empty($settings['recycle_enable']) && $settings['recycle_board'] > 0 ? '
			AND b.id_board != {int:recycle_board}' : '') . ')
		WHERE {query_see_board}' . (!empty($topic_ids) ? '
			AND t.id_topic IN ({array_int:topic_list})' : '
			AND {query_see_topic}') . '
		ORDER BY t.num_views DESC
		LIMIT 10',
		array(
			'topic_list' => $topic_ids,
			'recycle_board' => $settings['recycle_board'],
		)
	);
	$context['top_topics_views'] = array();
	$max_num_views = 1;
	while ($row_topic_views = wesql::fetch_assoc($topic_view_result))
	{
		censorText($row_topic_views['subject']);

		$context['top_topics_views'][] = array(
			'id' => $row_topic_views['id_topic'],
			'board' => array(
				'id' => $row_topic_views['id_board'],
				'name' => $row_topic_views['name'],
				'href' => $scripturl . '?board=' . $row_topic_views['id_board'] . '.0',
				'link' => '<a href="' . $scripturl . '?board=' . $row_topic_views['id_board'] . '.0">' . $row_topic_views['name'] . '</a>'
			),
			'subject' => $row_topic_views['subject'],
			'num_views' => $row_topic_views['num_views'],
			'href' => $scripturl . '?topic=' . $row_topic_views['id_topic'] . '.0',
			'link' => '<a href="' . $scripturl . '?topic=' . $row_topic_views['id_topic'] . '.0">' . $row_topic_views['subject'] . '</a>'
		);

		$max_num_views = max($max_num_views, $row_topic_views['num_views']);
	}
	wesql::free_result($topic_view_result);

	foreach ($context['top_topics_views'] as $i => $topic)
	{
		$context['top_topics_views'][$i]['post_percent'] = round(($topic['num_views'] * 100) / $max_num_views);
		$context['top_topics_views'][$i]['num_views'] = comma_format($context['top_topics_views'][$i]['num_views']);
	}

	// Try to cache this when possible, because it's a little unavoidably slow.
	if (($members = cache_get_data('stats_top_starters', 360)) == null)
	{
		$request = wesql::query('
			SELECT id_member_started, COUNT(*) AS hits
			FROM {db_prefix}topics' . (!empty($settings['recycle_enable']) && $settings['recycle_board'] > 0 ? '
			WHERE id_board != {int:recycle_board}' : '') . '
			GROUP BY id_member_started
			ORDER BY hits DESC
			LIMIT 20',
			array(
				'recycle_board' => $settings['recycle_board'],
			)
		);
		$members = array();
		while ($row = wesql::fetch_assoc($request))
			$members[$row['id_member_started']] = $row['hits'];
		wesql::free_result($request);

		cache_put_data('stats_top_starters', $members, 360);
	}

	if (empty($members))
		$members = array(0 => 0);

	// Topic poster top 10.
	$members_result = wesql::query('
		SELECT id_member, real_name
		FROM {db_prefix}members
		WHERE id_member IN ({array_int:member_list})
		ORDER BY FIND_IN_SET(id_member, {string:top_topic_posters})
		LIMIT 10',
		array(
			'member_list' => array_keys($members),
			'top_topic_posters' => implode(',', array_keys($members)),
		)
	);
	$context['top_starters'] = array();
	$max_num_topics = 1;
	while ($row_members = wesql::fetch_assoc($members_result))
	{
		$context['top_starters'][] = array(
			'name' => $row_members['real_name'],
			'id' => $row_members['id_member'],
			'num_topics' => $members[$row_members['id_member']],
			'href' => $scripturl . '?action=profile;u=' . $row_members['id_member'],
			'link' => '<a href="' . $scripturl . '?action=profile;u=' . $row_members['id_member'] . '">' . $row_members['real_name'] . '</a>'
		);

		$max_num_topics = max($max_num_topics, $members[$row_members['id_member']]);
	}
	wesql::free_result($members_result);

	foreach ($context['top_starters'] as $i => $topic)
	{
		$context['top_starters'][$i]['post_percent'] = round(($topic['num_topics'] * 100) / $max_num_topics);
		$context['top_starters'][$i]['num_topics'] = comma_format($context['top_starters'][$i]['num_topics']);
	}

	// Time online top 10.
	$temp = cache_get_data('stats_total_time_members', 600);
	$members_result = wesql::query('
		SELECT id_member, real_name, total_time_logged_in
		FROM {db_prefix}members' . (!empty($temp) ? '
		WHERE id_member IN ({array_int:member_list_cached})' : '') . '
		ORDER BY total_time_logged_in DESC
		LIMIT 20',
		array(
			'member_list_cached' => $temp,
		)
	);
	$context['top_time_online'] = array();
	$temp2 = array();
	$max_time_online = 1;
	while ($row_members = wesql::fetch_assoc($members_result))
	{
		$temp2[] = (int) $row_members['id_member'];
		if (count($context['top_time_online']) >= 10)
			continue;

		// Figure out the days, hours and minutes.
		$timeDays = floor($row_members['total_time_logged_in'] / 86400);
		$timeHours = floor(($row_members['total_time_logged_in'] % 86400) / 3600);

		// Figure out which things to show... (days, hours, minutes, etc.)
		$timelogged = '';
		if ($timeDays > 0)
			$timelogged .= $timeDays . $txt['totalTimeLogged_d_short'];
		// Don't bother to show hours for your forum barflies.
		if (($timeHours > 0 || $timeDays < 30) && $timeDays < 100)
			$timelogged .= $timeHours . $txt['totalTimeLogged_h_short'];
		// And don't show minutes for your... more... humanoid regulars.
		if ($timeDays < 30)
			$timelogged .= floor(($row_members['total_time_logged_in'] % 3600) / 60) . $txt['totalTimeLogged_m_short'];

		$context['top_time_online'][] = array(
			'id' => $row_members['id_member'],
			'name' => $row_members['real_name'],
			'time_online' => $timelogged,
			'seconds_online' => $row_members['total_time_logged_in'],
			'href' => $scripturl . '?action=profile;u=' . $row_members['id_member'],
			'link' => '<a href="' . $scripturl . '?action=profile;u=' . $row_members['id_member'] . '">' . $row_members['real_name'] . '</a>'
		);

		$max_time_online = max($max_time_online, $row_members['total_time_logged_in']);
	}
	wesql::free_result($members_result);

	foreach ($context['top_time_online'] as $i => $member)
		$context['top_time_online'][$i]['time_percent'] = round(($member['seconds_online'] * 100) / $max_time_online);

	// Cache the ones we found for a bit, just so we don't have to look again.
	if ($temp !== $temp2)
		cache_put_data('stats_total_time_members', $temp2, 480);

	// Liked posts top 10.
	$likes_result = wesql::query('
		SELECT COUNT(k.id_member) AS likes, m.id_member, m.real_name, msg.id_msg, msg.id_topic, msg.subject
		FROM {db_prefix}likes AS k
			INNER JOIN {db_prefix}messages AS msg ON k.id_content = msg.id_msg AND k.content_type = {literal:post}
			LEFT JOIN {db_prefix}members AS m ON msg.id_member = m.id_member
		GROUP BY msg.id_msg
		ORDER BY likes DESC
		LIMIT 10'
	);
	$max_num_likes = 0;
	$context['top_likes'] = array();
	while ($row_likes = wesql::fetch_assoc($likes_result))
	{
		$context['top_likes'][] = array(
			'num_likes' => $row_likes['likes'],
			'subject' => $row_likes['subject'],
			'member_name' => $row_likes['real_name'],
			'id_member' => $row_likes['id_member'],
			'href' => '<URL>?topic=' . $row_likes['id_topic'] . '.msg' . $row_likes['id_msg'] . '#msg' . $row_likes['id_msg'],
			'link' => '<a href="<URL>?topic=' . $row_likes['id_topic'] . '.msg' . $row_likes['id_msg'] . '#msg' . $row_likes['id_msg'] . '">' . $row_likes['subject'] . '</a> (<a href="<URL>?action=profile;u=' . $row_likes['id_member'] . '">' . $row_likes['real_name'] . '</a>)'
		);

		$max_num_likes = max($max_num_likes, $row_likes['likes']);
	}
	wesql::free_result($likes_result);

	foreach ($context['top_likes'] as $i => $like)
	{
		$context['top_likes'][$i]['post_percent'] = round(($like['num_likes'] * 100) / $max_num_likes);
		$context['top_likes'][$i]['num_likes'] = comma_format($context['top_likes'][$i]['num_likes']);
	}

	// Liked authors top 10.
	$likes_result = wesql::query('
		SELECT COUNT(k.id_content) AS likes, m.id_member, m.real_name
		FROM {db_prefix}likes AS k
		LEFT JOIN {db_prefix}messages AS msg ON k.id_content = msg.id_msg AND k.content_type = {literal:post}
		LEFT JOIN {db_prefix}members AS m ON msg.id_member = m.id_member
		GROUP BY msg.id_member
		ORDER BY likes DESC
		LIMIT 10'
	);
	$max_num_likes = 0;
	$context['top_author_likes'] = array();
	while ($row_likes = wesql::fetch_assoc($likes_result))
	{
		$context['top_author_likes'][] = array(
			'num_likes' => $row_likes['likes'],
			'member_name' => $row_likes['real_name'],
			'id_member' => $row_likes['id_member']
		);

		$max_num_likes = max($max_num_likes, $row_likes['likes']);
	}
	wesql::free_result($likes_result);

	foreach ($context['top_author_likes'] as $i => $like)
	{
		$context['top_author_likes'][$i]['post_percent'] = round(($like['num_likes'] * 100) / $max_num_likes);
		$context['top_author_likes'][$i]['num_likes'] = comma_format($context['top_author_likes'][$i]['num_likes']);
	}

	// Activity by month.
	$months_result = wesql::query('
		SELECT
			YEAR(date) AS stats_year, MONTH(date) AS stats_month, SUM(hits) AS hits, SUM(registers) AS registers, SUM(topics) AS topics, SUM(posts) AS posts, MAX(most_on) AS most_on, COUNT(*) AS num_days
		FROM {db_prefix}log_activity
		GROUP BY stats_year, stats_month',
		array()
	);

	$context['yearly'] = array();
	while ($row_months = wesql::fetch_assoc($months_result))
	{
		$id_month = $row_months['stats_year'] . sprintf('%02d', $row_months['stats_month']);
		$expanded = !empty($_SESSION['expanded_stats'][$row_months['stats_year']]) && in_array($row_months['stats_month'], $_SESSION['expanded_stats'][$row_months['stats_year']]);

		if (!isset($context['yearly'][$row_months['stats_year']]))
			$context['yearly'][$row_months['stats_year']] = array(
				'year' => $row_months['stats_year'],
				'new_topics' => 0,
				'new_posts' => 0,
				'new_members' => 0,
				'most_members_online' => 0,
				'hits' => 0,
				'num_months' => 0,
				'months' => array(),
				'expanded' => false,
				'current_year' => $row_months['stats_year'] == date('Y'),
			);

		$context['yearly'][$row_months['stats_year']]['months'][(int) $row_months['stats_month']] = array(
			'id' => $id_month,
			'date' => array(
				'month' => sprintf('%02d', $row_months['stats_month']),
				'year' => $row_months['stats_year']
			),
			'href' => $scripturl . '?action=stats;' . ($expanded ? 'collapse' : 'expand') . '=' . $id_month . '#m' . $id_month,
			'link' => '<a href="' . $scripturl . '?action=stats;' . ($expanded ? 'collapse' : 'expand') . '=' . $id_month . '#m' . $id_month . '">' . $txt['months'][(int) $row_months['stats_month']] . ' ' . $row_months['stats_year'] . '</a>',
			'month' => $txt['months'][(int) $row_months['stats_month']],
			'year' => $row_months['stats_year'],
			'new_topics' => comma_format($row_months['topics']),
			'new_posts' => comma_format($row_months['posts']),
			'new_members' => comma_format($row_months['registers']),
			'most_members_online' => comma_format($row_months['most_on']),
			'hits' => comma_format($row_months['hits']),
			'num_days' => $row_months['num_days'],
			'days' => array(),
			'expanded' => $expanded
		);

		$context['yearly'][$row_months['stats_year']]['new_topics'] += $row_months['topics'];
		$context['yearly'][$row_months['stats_year']]['new_posts'] += $row_months['posts'];
		$context['yearly'][$row_months['stats_year']]['new_members'] += $row_months['registers'];
		$context['yearly'][$row_months['stats_year']]['hits'] += $row_months['hits'];
		$context['yearly'][$row_months['stats_year']]['num_months']++;
		$context['yearly'][$row_months['stats_year']]['expanded'] |= $expanded;
		$context['yearly'][$row_months['stats_year']]['most_members_online'] = max($context['yearly'][$row_months['stats_year']]['most_members_online'], $row_months['most_on']);
	}

	krsort($context['yearly']);

	$context['collapsed_years'] = array();
	foreach ($context['yearly'] as $year => $data)
	{
		// This gets rid of the filesort on the query ;).
		krsort($context['yearly'][$year]['months']);

		$context['yearly'][$year]['new_topics'] = comma_format($data['new_topics']);
		$context['yearly'][$year]['new_posts'] = comma_format($data['new_posts']);
		$context['yearly'][$year]['new_members'] = comma_format($data['new_members']);
		$context['yearly'][$year]['most_members_online'] = comma_format($data['most_members_online']);
		$context['yearly'][$year]['hits'] = comma_format($data['hits']);

		// Keep a list of collapsed years.
		if (!$data['expanded'] && !$data['current_year'])
			$context['collapsed_years'][] = $year;
	}

	if (empty($_SESSION['expanded_stats']))
		return;

	$condition_text = array();
	$condition_params = array();
	foreach ($_SESSION['expanded_stats'] as $year => $months)
		if (!empty($months))
		{
			$condition_text[] = 'YEAR(date) = {int:year_' . $year . '} AND MONTH(date) IN ({array_int:months_' . $year . '})';
			$condition_params['year_' . $year] = $year;
			$condition_params['months_' . $year] = $months;
		}

	// No daily stats to even look at?
	if (empty($condition_text))
		return;

	getDailyStats(implode(' OR ', $condition_text), $condition_params);
}

function getDailyStats($condition_string, $condition_parameters = array())
{
	global $context;

	// Activity by day.
	$days_result = wesql::query('
		SELECT YEAR(date) AS stats_year, MONTH(date) AS stats_month, DAYOFMONTH(date) AS stats_day, topics, posts, registers, most_on, hits
		FROM {db_prefix}log_activity
		WHERE ' . $condition_string . '
		ORDER BY stats_day DESC',
		$condition_parameters
	);
	while ($row_days = wesql::fetch_assoc($days_result))
		$context['yearly'][$row_days['stats_year']]['months'][(int) $row_days['stats_month']]['days'][] = array(
			'day' => sprintf('%02d', $row_days['stats_day']),
			'month' => sprintf('%02d', $row_days['stats_month']),
			'year' => $row_days['stats_year'],
			'new_topics' => comma_format($row_days['topics']),
			'new_posts' => comma_format($row_days['posts']),
			'new_members' => comma_format($row_days['registers']),
			'most_members_online' => comma_format($row_days['most_on']),
			'hits' => comma_format($row_days['hits'])
		);
	wesql::free_result($days_result);
}
