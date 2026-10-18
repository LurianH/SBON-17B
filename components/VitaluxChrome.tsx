'use client';
import Link from 'next/link';
import {CalendarDays} from 'lucide-react';
import {MainNavigation} from '@/components/MainNavigation';
import {LogoutButton} from '@/components/LogoutButton';
import '@/app/approved-dashboard.css';
import './vitalux-chrome.css';

export function VitaluxChrome({children,lastUpdated,year,title='SBON 17B'}:{children:React.ReactNode;lastUpdated?:string|null;year?:number;title?:string}){
 const date=lastUpdated?new Intl.DateTimeFormat('pt-BR').format(new Date(lastUpdated+'T12:00:00')):'Aguardando atualização';
 return <div className="va-app">
  <header className="va-header">
   <Link href="/" className="va-brand-link" aria-label="Vitalux Ecoativa, abrir Dashboard">
    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAc0AAAB5CAYAAABbaXrKAAAK5klEQVR4nO3d4Y6sKBCGYXuz93/LvX/WpI9HpYCi6gPeJ5lkMtMtKEiJAn6+3+8BAADK/snOAAAAsyBoAgBgRNAEAMCIoAkAgNG/2RmYSGnE1CckFwCANATNMuvw4u9B4FxJ77By6gKwIG7PvqttOJm/AwALI2j6I3ACwKIIms96gh+BEwAWRNAEAMCIoHmPniIA4C8ETQAAjAiaAAAYMU9zfr+3kpkbCAAD0dMEAMCIoHlvlh4bA5YAIBBBc4yIoEvABIBgBM1nyr1NAiYAJCBovmsJnKODLQETAJIQNMusQfBT8dlWBEwASMSUE5szGN4FrajbuARMAEhG0KyT9ZyTgAkAArg9q4+ACQAiCJraCJgAIISgCQCAEUFTF71MABBD0NREwAQAQYye1bNDwKzZR+WVmQBsxho0exvyUQ3fyHz1bLt1f3v3xyvgepbXiH2aPZBm1K07KvnYyQ4XxbMy1emonub38D/JlCtfy/4q70+NiP3Y+R2iI86lFqV8rHgBd1I4/vBnOreszzRXrCRK+7RCwPweOfuxwrFbkdf55VW+BEy4iHym6XmFvFJDOfu+KOT/zAMNmpbPoVU/ennWL+qqFnMdqRk9u1Ihq+yLQoPSKqtn+UYtP/ChUK4qbQaSRU858aj8CieQh5n3QznvynnbUfbdJeoDXO04T5MrRiBWVuBUvC2LydUGTSqPD65+x+L46pm17Zg13xgko6fZ06CpzhetQYOOXXmcf9bzx+M8U2gvIKYlaFKRMAMuTjRFBE4CJoaZaRm9VRpBlWH4kWoaoN2ODdo8TWGj/qxLYlGT1qDZ2/BnrGqidOX4lJcVbj+fWvOy40XFbtTLWOk8sshcanJk2m915Pq/sDKbqae5A/XGxMKj8q5wHPDOo4yvF9873ZatvUUduRxhb9rWHuX38ntI2fUMBOrNYE0FX6kHtqrPwYopqOP5fHOXgNm6qIjHYiQ9abd89vPzN8s2QhZc2XGeJvzN0NhAU+SI2jcz1OHMxWEiAu71/zVB8PPzMzRw9t6eneE22gwnw8xGHt8Z6hf6Uc5lT8endP7dfa/mVuZbuXi+5ab0+be0rv8769OQtin7maZlxziZNHExglWo1+WewTa/tziv22xtey1p3z1r7h0Aed2OJf/uZbv67Vn1k2FWHFd4y6pT6nX5blBNS549puf0pF36Xukz10E/ljStn63iETRHDgiil7mn71H3PANr2Hka2h3v+t8zX3rUsUqbOtJq5Z6m/MHHHwiUOI6483bG9sFrOtevVc+32p6pmVfQnLECIh+BEndoT3J7YNG9zNrtW5/FDsm3Sk/zaYQX1kOghMXoUdk7U+ptegfMX0P2yzNoKlVEpbyAQAkdM7YNmXkenXbNyGCJslPpaV7RuK6BQIke3o2kRKMrTuV8/Vx+95hX6sJ7nmbPJGWvOTWcGLlUTjqsYceFD+7mVK7G8tzxLPuMF3w8Uu1pYj70KjECdWpvw+ZbthqxIlBvb7M3bcQaVZnlThaE8y57qR4LzEptQWiZZi+jh7llTr4GWswQOK8dD/X89vAoj99teL8q7i8r3Z5duWIp8qyQ3q8Vw/xG3mHg7sWzlRaXmGqeJg3g2rwaHYIl7kQEtZkCZ2ZeZzpOIVbpadLwxvF6dyFlhjuRjTQBQUPNOzNr/j7EyKBJo4g71As8yQhiqoEzc9WeqLQzFk7otkpPEzEY3YwVqQbOq1nyWaN3lHztuz27jQ6a0z7sBRan1gBn5yc7/Tse78D0SnuW43Matmg7Pc21KFbsExc3eKJSb1Xy8csrcHqs/9z6/VLan8vnLKwvrHYXETR5W8EaFBsUtFEqSwaWlT0FztKx6w2UT8fUsr3atGvKzxowh9QJFjdYT+9k4Rkmf++up4xWDJi/v/duU7X+P+3b6PKMTPd3rdnfv5XUvCmlW1TQHLHosmLFVtFy4is1pifFPM1steM58uXIiu1Lbzvauk8eS1pa077uY23AHl5uPNNcV8Ttmxq1aXjk6W0bmQvMe5zYGcfTk/o0BrXjdWq9Fe31BqmItD9HfVpht+gjb8969jYVrwK9ePfKVU/+NyyhZmMZIai4v963Ze/+53XRpdrWlNZYjRpLMjrtt4FQKWXDM01EKlX2EQ28YtDwNtM+jg6Yv59ZPXCeMvOXkXZqecwYNNUr8Ko8e8AzNfKj8HLlNrW37HYJnAgS/UyTimfDccJqZn5+fBz7XeDgAQOBgDy73Vbr1Tv6sxeBEylBs6cCz3iit1LcV8U8zW6HZ0LRt2VHfP9E4NwcPU1tikFKMU+zizymOwZMbwTOjWUFzax5RjNS3O+ohfhHz71SOrYrvtxALbh47r/aviEIPc05KK6tOSo/EfuqeDyPY60LBNU52SrlTtDVUVUWmVNOaoaDq1T0bKOnKbSs3BHROHqlM0M98liy7G57Mxp5YaYwFYXAOaEZ52nOIHM1jtZt9W6jJS8tbzaoTadnxGVmo9YbPCN665np91IJnJjM5/tNv9gpZYAKWSd6Sa0n13yMyENEGop23W8gnULQBABgCgwEAgDAiKAJAIARQRMAACOCJgAARgRNAACMCJoAABgRNAEAMCJoAgBgRNAEAMCIoAlgJ9+DhdLRgQXbke23AWMNVezmrP/U/UnQ0wSwC7UA9X34HcIImlgVt+H6fA/tY1ibN8X9+Dz8DmHcnkU2GgtEUaxrinnCC3qaAHZAcIIL3qe5trtnOLUvqb6+mb70XKjlJdiWZ03W7ba+1Lz15d0eL/2u3TfLcWrdz4jjZ6mXNem8fefp863Ht/S5lvPr7TMqL5XH/+hp7uPtGVDp75bnW6Xt16bt8V2L1ny/pe/xrG3E1eyItDzK9u5zd3+3bM/6+dZ9bq0PLelF1g0Y8UxzD0/TOq6j91qvYN+mjfSkYdnudZuf4+9GxXIVX5tvj6kykdNtrGmd/7N8vqV8Sulet9uat1K+zt+feos9dwt6j0Vpe0hET3Mv15PvrUF5+v75c/edu5Pb44QvbfctSLY0+G/fa/3c6G1kplVbPqXv9zxOKH3Oa/+jzgECphiC5j6eTr6I4FDTgNZ+bqSWfLeI3FevtCzbqe1hRmk9F1qf92IhBE14mbXB6M13ZBDyonBBkqFm7mntgKOaPNR+ftfykpT5TJOKYBMRjO6eA1pElaFiXfk9Zq3Pn67H3Tp6s8XItEaUT2udvKrdRm26d8fUw+i6oXhOqXg9xvQ09VG5dbVMeRmxDcW0sl17aJ/Lj3Ubd7/3qL2oulq1vKaR2dOc9XYe4inXlbsRnbWjL++enfaMZo5OS7l8jsM3f5aRx5486tfbdlGJniaOo/3qdYUTL6MHYd3O6F5FZFqReqdr1IwqjzoHanrIGIigCS/WSd+znvhKI0EVJr3PWo7H0f7Msnd0LRZA0NyHpaFVGUl6HH69oNJE+bfPtIx09NS6EMTotLzT7qEWqNTyA2esCLSXiFGOnreynkao1m63dnWb0vazpplYj8fItJ5WX8q8hXkdWdpznE41o2hHnAMEX1H0NPdRGsAweiBI6/ZHfs+y3x7PxFpEpjvjIKDSyFLvATsj6kmrmW+NT4+3nKxthmeJankcNWp1hJnymonjBDf0NIE/zdS4zpTXTBwnuCFoAgBgRNBEJrVbswDwitGzyPD2Ki8AkEVPE9kImACmQU9zbaoBSTVfAPCKniYAAEYETQAAjAiaAAAYETQBADD6DyiZbR5gRn4eAAAAAElFTkSuQmCC" alt="Vitalux Ecoativa — projetos sustentáveis" width={185} height={48}/>
   </Link>
   <div className="va-header-rule"/>
   <div className="va-breadcrumb">Painel Gerencial <span>›</span> <strong>{title}</strong></div>
   <div className="va-header-right">
    {lastUpdated!==undefined&&<div className="va-date"><CalendarDays size={20}/><span>Dados de execução<small>{date}</small></span></div>}
    {year!==undefined&&<div className="va-period"><span>Período<small>{year} (ano)</small></span></div>}
    <LogoutButton/>
   </div>
  </header>
  <aside className="va-sidebar"><MainNavigation/><div className="va-sidebar-end"><span className="va-leaf" aria-hidden="true">♧</span><p>Infraestrutura<br/>para um futuro<br/>mais sustentável.</p></div></aside>
  {children}
 </div>;
}
