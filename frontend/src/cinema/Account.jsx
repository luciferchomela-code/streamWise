import {useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useGoogleLogin} from '@react-oauth/google';
import {useAuth} from '../hooks/useAuth';
export default function Account() {
 const {user,loading,loginWithGoogleCode,logout}=useAuth(),[error,setError]=useState(''),nav=useNavigate();
 const login=useGoogleLogin({flow:'auth-code',onSuccess:async ({code})=>{try{await loginWithGoogleCode(code);nav('/')}catch(e){setError(e.message)}},onError:()=>setError('Sign-in failed. Please try again.')});
 return <main className="folio"><article className="account-sheet"><h1>{user?user.name:'Sign in to StreamWise'}</h1>{user?<><p>{user.email}</p><nav className="rail"><Link to="/channel">My channel</Link><Link to="/history">Viewing history</Link></nav><button onClick={()=>logout().catch(e=>setError(e.message))}>Sign out</button></>:<button className="ticket" disabled={loading} onClick={()=>login()}>Continue with Google</button>}{error&&<p role="alert">{error}</p>}</article></main>;
}
