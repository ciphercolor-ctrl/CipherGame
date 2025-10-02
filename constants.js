// Shared constants for server and client (if using a build system)
// For this project, server will require this file, and client will use js/constants.js

const continentMap = {
    'North America': ['US', 'CA', 'MX', 'CU', 'DO', 'GT', 'HN', 'JM', 'PA', 'AG', 'AI', 'AW', 'BB', 'BL', 'BM', 'BS', 'BZ', 'CR', 'DM', 'GD', 'GL', 'GP', 'GU', 'HT', 'KN', 'KY', 'LC', 'MF', 'MP', 'MQ', 'MS', 'NI', 'PR', 'SX', 'TC', 'TT', 'VC', 'VG', 'VI'],
    'South America': ['BR', 'AR', 'CO', 'PE', 'CL', 'VE', 'EC', 'BO', 'PY', 'UY', 'GY', 'SR', 'GF', 'FK'],
    'Europe': ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'NO', 'TR', 'BE', 'AT', 'CH', 'PT', 'GR', 'PL', 'CZ', 'HU', 'RO', 'UA', 'IE', 'DK', 'FI', 'IS', 'LU', 'MT', 'CY', 'BG', 'HR', 'RS', 'SK', 'SI', 'LT', 'LV', 'EE', 'AL', 'BA', 'ME', 'MD', 'MK', 'RU', 'AD', 'AX', 'BY', 'FO', 'GG', 'GI', 'IM', 'JE', 'LI', 'MC', 'SM', 'SJ', 'VA', 'XK', 'GB-ENG', 'GB-NIR', 'GB-SCT', 'GB-WLS'],
    'Asia': ['JP', 'KR', 'CN', 'IN', 'ID', 'PH', 'VN', 'TH', 'MY', 'SG', 'PK', 'BD', 'IR', 'SA', 'AE', 'IQ', 'SY', 'IL', 'JO', 'LB', 'KW', 'QA', 'BH', 'OM', 'YE', 'AZ', 'GE', 'AM', 'KZ', 'UZ', 'KG', 'TJ', 'TM', 'AF', 'NP', 'LK', 'MM', 'LA', 'KH', 'BN', 'TL', 'BT', 'MV', 'HK', 'IO', 'KP', 'MO', 'PS', 'TW'],
    'Oceania': ['AU', 'NZ', 'PG', 'FJ', 'SB', 'VU', 'NC', 'PF', 'AS', 'CK', 'FM', 'GU', 'KI', 'MH', 'MP', 'NR', 'NU', 'PW', 'TK', 'TO', 'TV', 'UM', 'WF', 'WS'],
    'Africa': ['EG', 'ZA', 'NG', 'ET', 'KE', 'TZ', 'DZ', 'MA', 'SD', 'CD', 'AO', 'GH', 'CI', 'CM', 'UG', 'MZ', 'MG', 'ML', 'BF', 'NE', 'BJ', 'TG', 'SL', 'LR', 'GW', 'GM', 'SN', 'MR', 'EH', 'LY', 'TN', 'ER', 'DJ', 'SO', 'RW', 'BI', 'ZM', 'ZW', 'MW', 'LS', 'SZ', 'NA', 'BW', 'GA', 'CG', 'GQ', 'CF', 'TD', 'SS', 'KM', 'SC', 'MU', 'CV', 'ST', 'RE', 'YT']
};

const countries = {
    'AD': { name: 'Andorra', flag: 'assets/flags/ad.png' },
    'AE': { name: 'United Arab Emirates', flag: 'assets/flags/ae.png' },
    'AF': { name: 'Afghanistan', flag: 'assets/flags/af.png' },
    'AG': { name: 'Antigua and Barbuda', flag: 'assets/flags/ag.png' },
    'AI': { name: 'Anguilla', flag: 'assets/flags/ai.png' },
    'AL': { name: 'Albania', flag: 'assets/flags/al.png' },
    'AM': { name: 'Armenia', flag: 'assets/flags/am.png' },
    'AO': { name: 'Angola', flag: 'assets/flags/ao.png' },
    'AQ': { name: 'Antarctica', flag: 'assets/flags/aq.png' },
    'AR': { name: 'Argentina', flag: 'assets/flags/ar.png' },
    'AS': { name: 'American Samoa', flag: 'assets/flags/as.png' },
    'AT': { name: 'Austria', flag: 'assets/flags/at.png' },
    'AU': { name: 'Australia', flag: 'assets/flags/au.png' },
    'AW': { name: 'Aruba', flag: 'assets/flags/aw.png' },
    'AX': { name: 'Åland Islands', flag: 'assets/flags/ax.png' },
    'AZ': { name: 'Azerbaijan', flag: 'assets/flags/az.png' },
    'BA': { name: 'Bosnia and Herzegovina', flag: 'assets/flags/ba.png' },
    'BB': { name: 'Barbados', flag: 'assets/flags/bb.png' },
    'BD': { name: 'Bangladesh', flag: 'assets/flags/bd.png' },
    'BE': { name: 'Belgium', flag: 'assets/flags/be.png' },
    'BF': { name: 'Burkina Faso', flag: 'assets/flags/bf.png' },
    'BG': { name: 'Bulgaria', flag: 'assets/flags/bg.png' },
    'BH': { name: 'Bahrain', flag: 'assets/flags/bh.png' },
    'BI': { name: 'Burundi', flag: 'assets/flags/bi.png' },
    'BJ': { name: 'Benin', flag: 'assets/flags/bj.png' },
    'BL': { name: 'Saint Barthélemy', flag: 'assets/flags/bl.png' },
    'BM': { name: 'Bermuda', flag: 'assets/flags/bm.png' },
    'BN': { name: 'Brunei Darussalam', flag: 'assets/flags/bn.png' },
    'BO': { name: 'Bolivia', flag: 'assets/flags/bo.png' },
    'BQ': { name: 'Bonaire, Sint Eustatius and Saba', flag: 'assets/flags/bq.png' },
    'BR': { name: 'Brazil', flag: 'assets/flags/br.png' },
    'BS': { name: 'Bahamas', flag: 'assets/flags/bs.png' },
    'BT': { name: 'Bhutan', flag: 'assets/flags/bt.png' },
    'BV': { name: 'Bouvet Island', flag: 'assets/flags/bv.png' },
    'BW': { name: 'Botswana', flag: 'assets/flags/bw.png' },
    'BY': { name: 'Belarus', flag: 'assets/flags/by.png' },
    'BZ': { name: 'Belize', flag: 'assets/flags/bz.png' },
    'CA': { name: 'Canada', flag: 'assets/flags/ca.png' },
    'CC': { name: 'Cocos (Keeling) Islands', flag: 'assets/flags/cc.png' },
    'CD': { name: 'Congo, Democratic Republic of the', flag: 'assets/flags/cd.png' },
    'CF': { name: 'Central African Republic', flag: 'assets/flags/cf.png' },
    'CG': { name: 'Congo', flag: 'assets/flags/cg.png' },
    'CH': { name: 'Switzerland', flag: 'assets/flags/ch.png' },
    'CI': { name: 'Côte d\'Ivoire', flag: 'assets/flags/ci.png' },
    'CK': { name: 'Cook Islands', flag: 'assets/flags/ck.png' },
    'CL': { name: 'Chile', flag: 'assets/flags/cl.png' },
    'CM': { name: 'Cameroon', flag: 'assets/flags/cm.png' },
    'CN': { name: 'China', flag: 'assets/flags/cn.png' },
    'CO': { name: 'Colombia', flag: 'assets/flags/co.png' },
    'CR': { name: 'Costa Rica', flag: 'assets/flags/cr.png' },
    'CU': { name: 'Cuba', flag: 'assets/flags/cu.png' },
    'CV': { name: 'Cabo Verde', flag: 'assets/flags/cv.png' },
    'CW': { name: 'Curaçao', flag: 'assets/flags/cw.png' },
    'CX': { name: 'Christmas Island', flag: 'assets/flags/cx.png' },
    'CY': { name: 'Cyprus', flag: 'assets/flags/cy.png' },
    'CZ': { name: 'Czechia', flag: 'assets/flags/cz.png' },
    'DE': { name: 'Germany', flag: 'assets/flags/de.png' },
    'DJ': { name: 'Djibouti', flag: 'assets/flags/dj.png' },
    'DK': { name: 'Denmark', flag: 'assets/flags/dk.png' },
    'DM': { name: 'Dominica', flag: 'assets/flags/dm.png' },
    'DO': { name: 'Dominican Republic', flag: 'assets/flags/do.png' },
    'DZ': { name: 'Algeria', flag: 'assets/flags/dz.png' },
    'EC': { name: 'Ecuador', flag: 'assets/flags/ec.png' },
    'EE': { name: 'Estonia', flag: 'assets/flags/ee.png' },
    'EG': { name: 'Egypt', flag: 'assets/flags/eg.png' },
    'EH': { name: 'Western Sahara', flag: 'assets/flags/eh.png' },
    'ER': { name: 'Eritrea', flag: 'assets/flags/er.png' },
    'ES': { name: 'Spain', flag: 'assets/flags/es.png' },
    'ET': { name: 'Ethiopia', flag: 'assets/flags/et.png' },
    'FI': { name: 'Finland', flag: 'assets/flags/fi.png' },
    'FJ': { name: 'Fiji', flag: 'assets/flags/fj.png' },
    'FK': { name: 'Falkland Islands (Malvinas)', flag: 'assets/flags/fk.png' },
    'FM': { name: 'Micronesia', flag: 'assets/flags/fm.png' },
    'FO': { name: 'Faroe Islands', flag: 'assets/flags/fo.png' },
    'FR': { name: 'France', flag: 'assets/flags/fr.png' },
    'GA': { name: 'Gabon', flag: 'assets/flags/ga.png' },
    'GB': { name: 'United Kingdom', flag: 'assets/flags/gb.png' },
    'GB-ENG': { name: 'England', flag: 'assets/flags/gb-eng.png' },
    'GB-NIR': { name: 'Northern Ireland', flag: 'assets/flags/gb-nir.png' },
    'GB-SCT': { name: 'Scotland', flag: 'assets/flags/gb-sct.png' },
    'GB-WLS': { name: 'Wales', flag: 'assets/flags/gb-wls.png' },
    'GD': { name: 'Grenada', flag: 'assets/flags/gd.png' },
    'GE': { name: 'Georgia', flag: 'assets/flags/ge.png' },
    'GF': { name: 'French Guiana', flag: 'assets/flags/gf.png' },
    'GG': { name: 'Guernsey', flag: 'assets/flags/gg.png' },
    'GH': { name: 'Ghana', flag: 'assets/flags/gh.png' },
    'GI': { name: 'Gibraltar', flag: 'assets/flags/gi.png' },
    'GL': { name: 'Greenland', flag: 'assets/flags/gl.png' },
    'GM': { name: 'Gambia', flag: 'assets/flags/gm.png' },
    'GN': { name: 'Guinea', flag: 'assets/flags/gn.png' },
    'GP': { name: 'Guadeloupe', flag: 'assets/flags/gp.png' },
    'GQ': { name: 'Equatorial Guinea', flag: 'assets/flags/gq.png' },
    'GR': { name: 'Greece', flag: 'assets/flags/gr.png' },
    'GS': { name: 'South Georgia and the South Sandwich Islands', flag: 'assets/flags/gs.png' },
    'GT': { name: 'Guatemala', flag: 'assets/flags/gt.png' },
    'GU': { name: 'Guam', flag: 'assets/flags/gu.png' },
    'GW': { name: 'Guinea-Bissau', flag: 'assets/flags/gw.png' },
    'GY': { name: 'Guyana', flag: 'assets/flags/gy.png' },
    'HK': { name: 'Hong Kong', flag: 'assets/flags/hk.png' },
    'HM': { name: 'Heard Island and McDonald Islands', flag: 'assets/flags/hm.png' },
    'HN': { name: 'Honduras', flag: 'assets/flags/hn.png' },
    'HR': { name: 'Croatia', flag: 'assets/flags/hr.png' },
    'HT': { name: 'Haiti', flag: 'assets/flags/ht.png' },
    'HU': { name: 'Hungary', flag: 'assets/flags/hu.png' },
    'ID': { name: 'Indonesia', flag: 'assets/flags/id.png' },
    'IE': { name: 'Ireland', flag: 'assets/flags/ie.png' },
    'IL': { name: 'Israel', flag: 'assets/flags/il.png' },
    'IM': { name: 'Isle of Man', flag: 'assets/flags/im.png' },
    'IN': { name: 'India', flag: 'assets/flags/in.png' },
    'IO': { name: 'British Indian Ocean Territory', flag: 'assets/flags/io.png' },
    'IQ': { name: 'Iraq', flag: 'assets/flags/iq.png' },
    'IR': { name: 'Iran', flag: 'assets/flags/ir.png' },
    'IS': { name: 'Iceland', flag: 'assets/flags/is.png' },
    'IT': { name: 'Italy', flag: 'assets/flags/it.png' },
    'JE': { name: 'Jersey', flag: 'assets/flags/je.png' },
    'JM': { name: 'Jamaica', flag: 'assets/flags/jm.png' },
    'JO': { name: 'Jordan', flag: 'assets/flags/jo.png' },
    'JP': { name: 'Japan', flag: 'assets/flags/jp.png' },
    'KE': { name: 'Kenya', flag: 'assets/flags/ke.png' },
    'KG': { name: 'Kyrgyzstan', flag: 'assets/flags/kg.png' },
    'KH': { name: 'Cambodia', flag: 'assets/flags/kh.png' },
    'KI': { name: 'Kiribati', flag: 'assets/flags/ki.png' },
    'KM': { name: 'Comoros', flag: 'assets/flags/km.png' },
    'KN': { name: 'Saint Kitts and Nevis', flag: 'assets/flags/kn.png' },
    'KP': { name: 'North Korea', flag: 'assets/flags/kp.png' },
    'KR': { name: 'South Korea', flag: 'assets/flags/kr.png' },
    'KW': { name: 'Kuwait', flag: 'assets/flags/kw.png' },
    'KY': { name: 'Cayman Islands', flag: 'assets/flags/ky.png' },
    'KZ': { name: 'Kazakhstan', flag: 'assets/flags/kz.png' },
    'LA': { name: 'Laos', flag: 'assets/flags/la.png' },
    'LB': { name: 'Lebanon', flag: 'assets/flags/lb.png' },
    'LC': { name: 'Saint Lucia', flag: 'assets/flags/lc.png' },
    'LI': { name: 'Liechtenstein', flag: 'assets/flags/li.png' },
    'LK': { name: 'Sri Lanka', flag: 'assets/flags/lk.png' },
    'LR': { name: 'Liberia', flag: 'assets/flags/lr.png' },
    'LS': { name: 'Lesotho', flag: 'assets/flags/ls.png' },
    'LT': { name: 'Lithuania', flag: 'assets/flags/lt.png' },
    'LU': { name: 'Luxembourg', flag: 'assets/flags/lu.png' },
    'LV': { name: 'Latvia', flag: 'assets/flags/lv.png' },
    'LY': { name: 'Libya', flag: 'assets/flags/ly.png' },
    'MA': { name: 'Morocco', flag: 'assets/flags/ma.png' },
    'MC': { name: 'Monaco', flag: 'assets/flags/mc.png' },
    'MD': { name: 'Moldova', flag: 'assets/flags/md.png' },
    'ME': { name: 'Montenegro', flag: 'assets/flags/me.png' },
    'MF': { name: 'Saint Martin (French part)', flag: 'assets/flags/mf.png' },
    'MG': { name: 'Madagascar', flag: 'assets/flags/mg.png' },
    'MH': { name: 'Marshall Islands', flag: 'assets/flags/mh.png' },
    'MK': { name: 'North Macedonia', flag: 'assets/flags/mk.png' },
    'ML': { name: 'Mali', flag: 'assets/flags/ml.png' },
    'MM': { name: 'Myanmar', flag: 'assets/flags/mm.png' },
    'MN': { name: 'Mongolia', flag: 'assets/flags/mn.png' },
    'MO': { name: 'Macao', flag: 'assets/flags/mo.png' },
    'MP': { name: 'Northern Mariana Islands', flag: 'assets/flags/mp.png' },
    'MQ': { name: 'Martinique', flag: 'assets/flags/mq.png' },
    'MR': { name: 'Mauritania', flag: 'assets/flags/mr.png' },
    'MS': { name: 'Montserrat', flag: 'assets/flags/ms.png' },
    'MT': { name: 'Malta', flag: 'assets/flags/mt.png' },
    'MU': { name: 'Mauritius', flag: 'assets/flags/mu.png' },
    'MV': { name: 'Maldives', flag: 'assets/flags/mv.png' },
    'MW': { name: 'Malawi', flag: 'assets/flags/mw.png' },
    'MX': { name: 'Mexico', flag: 'assets/flags/mx.png' },
    'MY': { name: 'Malaysia', flag: 'assets/flags/my.png' },
    'MZ': { name: 'Mozambique', flag: 'assets/flags/mz.png' },
    'NA': { name: 'Namibia', flag: 'assets/flags/na.png' },
    'NC': { name: 'New Caledonia', flag: 'assets/flags/nc.png' },
    'NE': { name: 'Niger', flag: 'assets/flags/ne.png' },
    'NF': { name: 'Norfolk Island', flag: 'assets/flags/nf.png' },
    'NG': { name: 'Nigeria', flag: 'assets/flags/ng.png' },
    'NI': { name: 'Nicaragua', flag: 'assets/flags/ni.png' },
    'NL': { name: 'Netherlands', flag: 'assets/flags/nl.png' },
    'NO': { name: 'Norway', flag: 'assets/flags/no.png' },
    'NP': { name: 'Nepal', flag: 'assets/flags/np.png' },
    'NR': { name: 'Nauru', flag: 'assets/flags/nr.png' },
    'NU': { name: 'Niue', flag: 'assets/flags/nu.png' },
    'NZ': { name: 'New Zealand', flag: 'assets/flags/nz.png' },
    'OM': { name: 'Oman', flag: 'assets/flags/om.png' },
    'PA': { name: 'Panama', flag: 'assets/flags/pa.png' },
    'PE': { name: 'Peru', flag: 'assets/flags/pe.png' },
    'PF': { name: 'French Polynesia', flag: 'assets/flags/pf.png' },
    'PG': { name: 'Papua New Guinea', flag: 'assets/flags/pg.png' },
    'PH': { name: 'Philippines', flag: 'assets/flags/ph.png' },
    'PK': { name: 'Pakistan', flag: 'assets/flags/pk.png' },
    'PL': { name: 'Poland', flag: 'assets/flags/pl.png' },
    'PM': { name: 'Saint Pierre and Miquelon', flag: 'assets/flags/pm.png' },
    'PN': { name: 'Pitcairn', flag: 'assets/flags/pn.png' },
    'PR': { name: 'Puerto Rico', flag: 'assets/flags/pr.png' },
    'PS': { name: 'Palestine, State of', flag: 'assets/flags/ps.png' },
    'PT': { name: 'Portugal', flag: 'assets/flags/pt.png' },
    'PW': { name: 'Palau', flag: 'assets/flags/pw.png' },
    'PY': { name: 'Paraguay', flag: 'assets/flags/py.png' },
    'QA': { name: 'Qatar', flag: 'assets/flags/qa.png' },
    'RE': { name: 'Réunion', flag: 'assets/flags/re.png' },
    'RO': { name: 'Romania', flag: 'assets/flags/ro.png' },
    'RS': { name: 'Serbia', flag: 'assets/flags/rs.png' },
    'RU': { name: 'Russian Federation', flag: 'assets/flags/ru.png' },
    'RW': { name: 'Rwanda', flag: 'assets/flags/rw.png' },
    'SA': { name: 'Saudi Arabia', flag: 'assets/flags/sa.png' },
    'SB': { name: 'Solomon Islands', flag: 'assets/flags/sb.png' },
    'SC': { name: 'Seychelles', flag: 'assets/flags/sc.png' },
    'SD': { name: 'Sudan', flag: 'assets/flags/sd.png' },
    'SE': { name: 'Sweden', flag: 'assets/flags/se.png' },
    'SG': { name: 'Singapore', flag: 'assets/flags/sg.png' },
    'SH': { name: 'Saint Helena, Ascension and Tristan da Cunha', flag: 'assets/flags/sh.png' },
    'SI': { name: 'Slovenia', flag: 'assets/flags/si.png' },
    'SJ': { name: 'Svalbard and Jan Mayen', flag: 'assets/flags/sj.png' },
    'SK': { name: 'Slovakia', flag: 'assets/flags/sk.png' },
    'SL': { name: 'Sierra Leone', flag: 'assets/flags/sl.png' },
    'SM': { name: 'San Marino', flag: 'assets/flags/sm.png' },
    'SN': { name: 'Senegal', flag: 'assets/flags/sn.png' },
    'SO': { name: 'Somalia', flag: 'assets/flags/so.png' },
    'SR': { name: 'Suriname', flag: 'assets/flags/sr.png' },
    'SS': { name: 'South Sudan', flag: 'assets/flags/ss.png' },
    'ST': { name: 'Sao Tome and Principe', flag: 'assets/flags/st.png' },
    'SV': { name: 'El Salvador', flag: 'assets/flags/sv.png' },
    'SX': { name: 'Sint Maarten (Dutch part)', flag: 'assets/flags/sx.png' },
    'SY': { name: 'Syrian Arab Republic', flag: 'assets/flags/sy.png' },
    'SZ': { name: 'Eswatini', flag: 'assets/flags/sz.png' },
    'TC': { name: 'Turks and Caicos Islands', flag: 'assets/flags/tc.png' },
    'TD': { name: 'Chad', flag: 'assets/flags/td.png' },
    'TF': { name: 'French Southern Territories', flag: 'assets/flags/tf.png' },
    'TG': { name: 'Togo', flag: 'assets/flags/tg.png' },
    'TH': { name: 'Thailand', flag: 'assets/flags/th.png' },
    'TJ': { name: 'Tajikistan', flag: 'assets/flags/tj.png' },
    'TK': { name: 'Tokelau', flag: 'assets/flags/tk.png' },
    'TL': { name: 'Timor-Leste', flag: 'assets/flags/tl.png' },
    'TM': { name: 'Turkmenistan', flag: 'assets/flags/tm.png' },
    'TN': { name: 'Tunisia', flag: 'assets/flags/tn.png' },
    'TO': { name: 'Tonga', flag: 'assets/flags/to.png' },
    'TR': { name: 'Turkey', flag: 'assets/flags/tr.png' },
    'TT': { name: 'Trinidad and Tobago', flag: 'assets/flags/tt.png' },
    'TV': { name: 'Tuvalu', flag: 'assets/flags/tv.png' },
    'TW': { name: 'Taiwan', flag: 'assets/flags/tw.png' },
    'TZ': { name: 'Tanzania', flag: 'assets/flags/tz.png' },
    'UA': { name: 'Ukraine', flag: 'assets/flags/ua.png' },
    'UG': { name: 'Uganda', flag: 'assets/flags/ug.png' },
    'UM': { name: 'United States Minor Outlying Islands', flag: 'assets/flags/um.png' },
    'US': { name: 'United States of America', flag: 'assets/flags/us.png' },
    'UY': { name: 'Uruguay', flag: 'assets/flags/uy.png' },
    'UZ': { name: 'Uzbekistan', flag: 'assets/flags/uz.png' },
    'VA': { name: 'Holy See', flag: 'assets/flags/va.png' },
    'VC': { name: 'Saint Vincent and the Grenadines', flag: 'assets/flags/vc.png' },
    'VE': { name: 'Venezuela', flag: 'assets/flags/ve.png' },
    'VG': { name: 'Virgin Islands (British)', flag: 'assets/flags/vg.png' },
    'VI': { name: 'Virgin Islands (U.S.)', flag: 'assets/flags/vi.png' },
    'VN': { name: 'Viet Nam', flag: 'assets/flags/vn.png' },
    'VU': { name: 'Vanuatu', flag: 'assets/flags/vu.png' },
    'WF': { name: 'Wallis and Futuna', flag: 'assets/flags/wf.png' },
    'WS': { name: 'Samoa', flag: 'assets/flags/ws.png' },
    'XK': { name: 'Kosovo', flag: 'assets/flags/xk.png' },
    'YE': { name: 'Yemen', flag: 'assets/flags/ye.png' },
    'YT': { name: 'Mayotte', flag: 'assets/flags/yt.png' },
    'ZA': { name: 'South Africa', flag: 'assets/flags/za.png' },
    'ZM': { name: 'Zambia', flag: 'assets/flags/zm.png' },
    'ZW': { name: 'Zimbabwe', flag: 'assets/flags/zw.png' }
};

const DEFAULT_AVATAR_URL = 'assets/logo.jpg';
const DEFAULT_CHAT_ROOM = 'Global';
const CHAT_MESSAGE_COOLDOWN = 2000; // milliseconds
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const PASSWORD_MIN_LENGTH = 6;
const MESSAGE_MAX_LENGTH = 500;

function getCountryCodeByName(countryName) {
    if (!countryName) return null;
    const trimmedCountryName = countryName.trim();
    for (const code in countries) {
        if (countries[code].name.toLowerCase() === trimmedCountryName.toLowerCase()) {
            return code;
        }
    }
    return null; // Or throw an error, or return a default
}

function getContinentByCountryCode(countryCode) {
    for (const continent in continentMap) {
        if (continentMap[continent].includes(countryCode)) {
            return continent;
        }
    }
    return DEFAULT_CHAT_ROOM; // Default to Global if country not found in any continent
}

const ALLOWED_CHAT_ROOMS = [
    'Global',
    'Europe',
    'Asia',
    'North-America',
    'South-America',
    'Africa',
    'Oceania'
];

function isValidChatRoom(room) {
    if (ALLOWED_CHAT_ROOMS.includes(room)) {
        return true;
    }
    if (room.startsWith('country-')) {
        const countryCode = room.split('-')[1];
        return countryCode in countries;
    }
    return false;
}


// For Node.js environment (server-side)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        continentMap,
        countries,
        getContinentByCountryCode,
        getCountryCodeByName,
        DEFAULT_AVATAR_URL,
        DEFAULT_CHAT_ROOM,
        CHAT_MESSAGE_COOLDOWN,
        USERNAME_MIN_LENGTH,
        USERNAME_MAX_LENGTH,
        PASSWORD_MIN_LENGTH,
        MESSAGE_MAX_LENGTH,
        ALLOWED_CHAT_ROOMS,
        isValidChatRoom
    };
}

// For browser environment (client-side)
if (typeof window !== 'undefined') {
    window.continentMap = continentMap;
    window.countries = countries;
    window.getContinentByCountryCode = getContinentByCountryCode;
    window.getCountryCodeByName = getCountryCodeByName;
    window.DEFAULT_AVATAR_URL = DEFAULT_AVATAR_URL;
    window.DEFAULT_CHAT_ROOM = DEFAULT_CHAT_ROOM;
    window.CHAT_MESSAGE_COOLDOWN = CHAT_MESSAGE_COOLDOWN;
    window.USERNAME_MIN_LENGTH = USERNAME_MIN_LENGTH;
    window.USERNAME_MAX_LENGTH = USERNAME_MAX_LENGTH;
    window.PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;
    window.MESSAGE_MAX_LENGTH = MESSAGE_MAX_LENGTH;
    window.ALLOWED_CHAT_ROOMS = ALLOWED_CHAT_ROOMS;
    window.isValidChatRoom = isValidChatRoom;
}
