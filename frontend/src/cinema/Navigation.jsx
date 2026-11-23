import SearchBox from './SearchBox';
import {Link, NavLink, useLocation} from 'react-router-dom';
import {useAuth} from '../hooks/useAuth';
import {Bell} from '../pages/Features/Community';

const groups = [
  ['Explore', [['/', 'Discover', 'M3 4h7v7H3z M14 4h7v7h-7z M3 15h7v6H3z M14 15h7v6h-7z'], ['/live','Live','M8 8a6 6 0 0 0 0 8 M16 8a6 6 0 0 1 0 8 M5 5a10 10 0 0 0 0 14 M19 5a10 10 0 0 1 0 14 M12 11v2'], ['/subscriptions','Following','M3 8h18v13H3z M6 4h12']]],
  ['Library', [['/saved','Watch later','M6 3h12v18l-6-4-6 4z'], ['/history','History','M3 10a9 9 0 1 1 1 8 M3 4v6h6 M12 7v6l4 2'], ['/playlists','Playlists','M3 6h17 M3 11h10 M3 16h7 M16 13v8l6-4z']]],
  ['Create', [['/studio','Creator studio','M3 4h18v16H3z M7 15v-3 M12 15V8 M17 15v-5'], ['/upload','Upload','M12 16V3 M7 8l5-5 5 5 M4 16v5h16v-5'], ['/channel','My channel','M3 5h18v14H3z M10 9v6l5-3z']]],
  ['Manage', [['/moderation','Moderation','M12 2l8 4v6c0 6-8 10-8 10s-8-4-8-10V6z'], ['/ops/playback-health','Playback health','M2 12h5l3-7 4 14 3-7h5']]]
];
function Directory(){
  return groups.map(([name,items])=><section className="nav-group" key={name}><h2>{name}</h2>{items.map(([path,label,d])=><NavLink key={path} to={path} end><svg aria-hidden="true" viewBox="0 0 24 24"><path d={d}/></svg>{label}</NavLink>)}</section>);
}
export default function Navigation(){
  const {user}=useAuth(), location=useLocation();
  return <><header className="mast"><Link className="wordmark" to="/"><i aria-hidden="true"/>StreamWise</Link>
    <SearchBox key={location.key} initialQuery={new URLSearchParams(location.search).get('q')||''}/>
    {user?<><Bell/><Link to="/profile">Account</Link></>:<Link to="/login">Sign in</Link>}</header>
    <aside className="directory"><nav aria-label="Main"><Directory/></nav></aside>
    <details key={location.key} className="mobile-directory"><summary>Browse StreamWise</summary><nav><Directory/></nav></details></>;
}
