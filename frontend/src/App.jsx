import { useState, useEffect } from "react";
import "./App.css";
import Header from "./components/Header.jsx";
import CandidateVotes from "./components/CandidateVotes.jsx";
import VoteSection from "./components/VoteSection.jsx";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contracts/config.js";

function App() {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [candidates, setCandidates] = useState([]);

  // 从合约中获取候选人真实数据
  const fetchContractData = async (currentAccount) => {
    if (!window.ethereum) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );
      const rawCandidates = await contract.getCandidates();
      const formattedCandidates = rawCandidates.map((c) => ({
        id: Number(c.id),
        name: c.name,
        voteCount: Number(c.voteCount),
      }));
      setCandidates(formattedCandidates);

      if (currentAccount) {
        const voted = await contract.checkIfVoted(currentAccount);
        setHasVoted(voted);
      } else {
        setHasVoted(false);
      }
    } catch (error) {
      console.log(error, "其他错误+++++++++555555555");
    } finally {
      setLoading(false);
    }
  };

  // 监听account状态变动，首次挂载及切号时自动拉取链上区块数据
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchContractData(account);
  }, [account]);

  // 页面初始化时检查已连接的状态，并注册账号/链监听
  useEffect(() => {
    if (!window.ethereum) return;
    //1.自动检查是否授权
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      })
      .catch((error) => {
        console.error(error, "其他错误11111111111111111111");
      });

    //2.监听账户切换事件(在metamask切换账号或断开连接时候触发)
    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      } else {
        setAccount(null);
        setSelectedId("");
      }
    };

    //3.监听网络的切换事件(在metamask切换网络时候触发)
    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    //4.组件卸载时移除监听，防止内存泄漏
    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  // 模拟连接/断开钱包
  const handleConnectWallet = async () => {
    // 1. 检查浏览器是否已经安装了metamask钱包
    if (!window.ethereum) {
      alert("请安装MetaMask钱包");
      return;
    }
    // 2.如果当前已处于连接状态，点击则执行前端层面的断开重置
    if (account) {
      setAccount(null);
      setSelectedId("");
      return;
    }
    // 3.唤起metamask弹窗连接请求
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      }
    } catch (error) {
      if (error.code === 4001) {
        console.warn("用户拒绝了连接请求");
      } else {
        console.log(error, "其他错误");
      }
    }
  };

  // ========== 替换为链上真实投票函数 ==========
  const handleVote = async () => {
    // 1. 先进行前置安全校验，未选择候选人、未连接钱包或者无以太坊环境时直接拦截
    if (selectedId === "" || !account || !window.ethereum) {
      return;
    }
    try {
      setLoading(true);
      // 2. 创建 provider，并获取当前授权账户的签名者
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      // 3. 创建带有signer签名的合约实例(具备写权限)
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );
      // 4. 调用合约写方法 vote，此步骤会自动唤起MetaMask弹窗
      const tx = await contract.vote(selectedId);
      console.log(tx.hash, "++++++++++++++");
      // 5. 等待交易被区块打包确认(mining)
      await tx.wait();
      console.log("交易打包成功");
      // 6. 重新拉取链上数据
      await fetchContractData(account);
      setSelectedId("");
      alert("投票成功**********");
    } catch (error) {
      console.log(error, "++++++++++++++++++++错误");
      if (error.code === 4001 || error.code === "ACTION_REJECTED") {
        console.warn("用户拒绝了投票请求");
      } else if (error.reason) {
        alert(`投票失败:${error.reason}`);
      } else {
        console.log(error, "投票失败+++++");
        alert("投票失败请看控制台信息");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="voting-card">
      <Header account={account} />
      <CandidateVotes loading={loading} candidates={candidates} />
      <VoteSection
        account={account}
        hasVoted={hasVoted}
        candidates={candidates}
        selectedId={selectedId}
        onSelectCandidate={setSelectedId}
        onVote={handleVote}
        onConnectWallet={handleConnectWallet}
      />
    </div>
  );
};

export default App;
