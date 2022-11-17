import React, { useEffect, useState } from "react"
import { providers, Contract, BigNumber } from 'ethers'
import { ToastContainer, toast } from 'react-toastify'
import { BounceLoader } from "react-spinners"
import { MerkleTree } from 'merkletreejs'
import keccak256 from 'keccak256'

import abi from '../../constants/abi'
import { contractAddr } from '../../constants/index.js'
import whitelists from '../../constants/whitelists.json'

import 'react-toastify/dist/ReactToastify.css'

//Rinkeby
// const chainConfig = {
//   chainId: '0x4',
//   chainName: 'Rinkeby Testnet',
//   nativeCurrency: {
//     name: 'ETH',
//     symbol: 'ETH',
//     decimals: 18
//   },
//   rpcUrls: ['https://rinkeby.infura.io/v3/a96c6b2710b64f2380bf6045c1e9e13d/'],
//   blockExplorerUrls: ['https://rinkeby.etherscan.io']
// }
//Mainnet
const chainConfig = {
  chainId: '0x1',
  chainName: 'Ethereum Mainnet',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: ['https://mainnet.infura.io/v3/a96c6b2710b64f2380bf6045c1e9e13d/'],
  blockExplorerUrls: ['https://etherscan.io']
}

let nftContract, signer, provider, tree, root

//https://gateway.pinata.cloud/ipfs/QmPBYKxSU589fyURqyMxWupAszVmXoSnDt625wwYZEcaaY/1.json

const Home = () => {
  const [walletAddress, setWalletAddress] = useState('')
  const [saleStarted, setSaleStarted] = useState(false)
  const [presalePeriod, setPresalePeriod] = useState(0)
  const [price, setPrice] = useState()
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState(1)
  const [totalMinted, setTotalMinted] = useState(0)

  useEffect(() => {
    (async () => {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainConfig.chainId }],
        })
      } catch (switchError) {
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [chainConfig],
            })
          } catch (err) {
            console.log('error adding chain:', err)
          }
        }
      }
      provider = new providers.Web3Provider(window.ethereum);
      provider.on('accountsChanged', (accounts) => {
        setWalletAddress(accounts[0])
      });
      tree = new MerkleTree(whitelists, keccak256, {
        hashLeaves: true,
        sortPairs: true
      })
      root = tree.getRoot().toString('hex')
      console.log('root:', root)
    })()
  }, [])
  const connectWallet = async () => {
    await provider.send("eth_requestAccounts", []);
    provider.on('accountsChanged', (accounts) => {
      setWalletAddress(accounts[0])
    });
    signer = provider.getSigner();
    const wallet = await signer.getAddress()
    setWalletAddress(wallet)

    nftContract = new Contract(contractAddr, abi, signer)
    setLoading(true)
    const period = await nftContract.PRESALE_PERIOD()
    console.log('period:', period)
    setPresalePeriod((await nftContract.PRESALE_PERIOD()).toNumber())
    setSaleStarted(await nftContract.saleStarted())
    setBalance((await nftContract.balanceOf(wallet)).toNumber())
    setPrice(await nftContract.PRICE())
    setTotalMinted((await nftContract.totalMinted()).toNumber())

    setLoading(false)
  }
  const mint = async () => {
    try {
      if (!walletAddress) {
        return toast.error('Connect your wallet')
      }
      if (!saleStarted) {
        return toast.error('Sale has not started')
      }
      const time = (await nftContract.getTime()).toNumber()
      const proof = tree.getHexProof(keccak256(walletAddress))
      console.log('proof:', proof)
      console.log('time:', time, presalePeriod)
      if (time < presalePeriod) {
        setLoading(true)
        if (!whitelists.includes(walletAddress)) {
          setLoading(false)
          return toast.error('You are not whitelisted')
        }
        if (balance + amount > 2) {
          setLoading(false)
          return toast.error('Exceed max nfts in presale')
        }
        let tx = await nftContract.mint(proof, amount, { from: walletAddress })
        await tx.wait()
        toast.success('Minting Success')
        setBalance(balance + 1)
      } else {
        setLoading(true)
        const walletBalance = await provider.getBalance(walletAddress)
        const ttMinted = (await nftContract.totalMinted()).toNumber()
        let free = 0, payAmount
        if (ttMinted < 2777) {
          ++free
          if (whitelists.includes(walletAddress)) {
            free += 2
          }
          if (balance >= free) {
            free = 0
          } else {
            free -= balance
          }
          if (free > 2777 - ttMinted) {
            free = 2777 - ttMinted
          }
        }
        if (amount > free) {
          payAmount = amount - free
        } else {
          payAmount = 0
        }
        if (walletBalance.lt(price.mul(payAmount))) {
          setLoading(false)
          return toast.error('Insufficient fund')
        }
        console.log('payamount:', payAmount)
        let params = { from: walletAddress }
        if (payAmount > 0) {
          params = { ...params, value: price.mul(BigNumber.from(payAmount)) }
        }
        console.log('amount:', amount)
        let tx = await nftContract.mint(proof, amount, params)
        await tx.wait()
        toast.success('Minting Success')
        setBalance(balance + amount)
      }
    } catch (err) {
      console.log('error:', err)
    }
    setLoading(false)
  }
  return (
    <div className='home'>
      <div className='home__icons'>
        <a href='https://twitter.com/eldertownwtf' target='_blank' rel="noreferrer"><img src="/assets/twitter.png" alt='' /></a>
        <a href='https://opensea.io/' target='_blank' rel="noreferrer"><img src="/assets/opensea.png" alt='' /></a>
        <a href='https://etherscan.io/address/0xEBc57E40163eceD9A2D5E5B67c876335eF108a65' target='_blank' rel="noreferrer"><img src="/assets/etherscan.png" alt='' /></a>
      </div>
      {!!walletAddress ? <img className="home__wallet" src="/assets/2_but.png" alt='' onClick={() => setWalletAddress('')} /> : <img className="home__wallet" src="/assets/button.png" alt='' onClick={() => connectWallet()} />}
      <div className='home__boxes'>
        <div className='home__boxes__box'>
          <img src="/assets/card1.png" alt='' />
          <div className='home__boxes__box__upper'>
            <img src="/assets/fGif.gif" alt='' />
          </div>
          <div className='home__boxes__box__lower'>
            <div className='home__boxes__box__lower__btns'>
              <div className='home__boxes__box__lower__btns__btn' style={{ textAlign: 'center' }}>
                {totalMinted}/7777
              </div>
              <div className='home__boxes__box__lower__btns__btn'>
                <img src="/assets/phonebtn1.png" alt='' />
                <div style={{ marginLeft: '90px', fontSize: '20px' }}>
                  <button onClick={() => setAmount(amount > 1 ? amount - 1 : amount)} style={{ marginRight: '10px', background: 'none', border: 'none', fontSize: '20px' }}>-</button>
                  {amount}
                  <button onClick={() => setAmount(amount + 1 <= 20 ? amount + 1 : amount)} style={{ marginLeft: '10px', background: 'none', border: 'none', fontSize: '20px' }}>+</button>
                </div>
              </div>
              <div className='home__boxes__box__lower__btns__btn'>
                <img src="/assets/phonebtn1.png" alt='' />
                <h2 onClick={() => mint()} style={{ marginLeft: '80px' }}>MINT</h2>
              </div>
              <div className='home__boxes__box__lower__btns__btn'>
                <img src="/assets/phonebtn1.png" alt='' className="home__boxes__box__lower__btns__btn_bigBtn" />
                <h4>Elder Goblins teach younger Gobbis lessons aaauuuggghh.</h4>
              </div>
            </div>
          </div>
        </div>

        <div className='home__boxes__phoneBox'>
          <div className='home__boxes__phoneBox__inner'>
            <div className='home__boxes__phoneBox__inner__logo'>
              <img src="/assets/fGif.gif" alt='' />
            </div>
            <div className='home__boxes__phoneBox__inner__btns'>
              <div className='home__boxes__phoneBox__inner__btns__btn' style={{ textAlign: 'center', marginTop: '5px' }}>
                {totalMinted}/7777
              </div>
              <div className='home__boxes__phoneBox__inner__btns__btn'>
                <img src="/assets/phonebtn1.png" alt='' />
                <div>
                  <button onClick={() => setAmount(amount > 1 ? amount - 1 : amount)} style={{ marginRight: '10px', background: 'none', border: 'none', fontSize: '20px' }}>-</button>
                  {amount}
                  <button onClick={() => setAmount(amount + 1 <= 20 ? amount + 1 : amount)} style={{ marginLeft: '10px', background: 'none', border: 'none', fontSize: '20px' }}>+</button>
                </div>
              </div>
              <div className='home__boxes__phoneBox__inner__btns__btn'>
                <img src="/assets/phonebtn1.png" alt='' />
                <h2 onClick={() => mint()} style={{ marginLeft: '70px' }}>MINT</h2>
              </div>
              <div className='home__boxes__phoneBox__inner__btns__btn'>
                <img src="/assets/phonebtn1.png" alt='' />
                <h4>Elder Goblins teach younger Gobbis lessons aaauuuggghh.</h4>
              </div>
            </div>
          </div>
        </div>

        <div className='home__boxes__box home__boxes__box__white'>
          <div className='home__boxes__box__white__upper'>
            <h3>The OGs = 2 free + gas mint per wallet.</h3>
            <span>7,777 max supply</span>
          </div>
          <div className='home__boxes__box__white__image'>
            <img src="/assets/sGif.gif" alt='' />
          </div>
          <div className='home__boxes__box__white__third'>
            <h3>Elder goblin have more experience.teach goblin lessons.</h3>
          </div>
          <div className='home__boxes__box__white__four'>
            <h3>
              No Roadmap. Little Utility. Lessons. Contract was actually written
              by an elder goblin.
            </h3>
          </div>
          <div className='home__boxes__box__white__footer'>
            <h3>#ELDERSFOLLOWELDERS</h3>
          </div>
        </div>
      </div>
      <ToastContainer />
      {loading && <div style={{ width: '100%', height: '100%', position: 'fixed', top: '0px', left: '0px', background: 'white', opacity: '50%', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><BounceLoader color='#36D7B7' /></div>}
    </div>
  );
};

export default Home;
