import React, { Component } from 'react';
import './App.css';
import {Button,Col,  Modal, Layout, message, Tooltip, Breadcrumb, Row,   Table, Spin, notification  } from 'antd';
import Web3 from "web3";

import RentalContract from "./contracts/RentalContract.json";
import PlaylistContract from "./contracts/PlaylistContract.json";
import _ from 'lodash';
// const web3 = new Web3('http://localhost:8545', options);
var moment = require('moment-timezone');

const { Header, Content, Footer } = Layout;
const mediaScheduleUrl="http://localhost:3005/api/mediaSchedule";
const transactionLogApiUrl="http://localhost:3005/api/transactionLogs";
const web3 = new Web3('ws://10.0.0.52:8546')
web3.transactionConfirmationBlocks = 2;

const address ="0xCEf98AB22b9d547B7dFD63cBcEFF32f2534b49c6";

/**
 * 
 * account[1] 是seller account
 * account[2] 是buyer account
 * account[3] 是system account
 * account[4] 是player account
 * account[5] 是temp account 
 * */ 
class App extends Component {
  constructor(props, context) {
		super(props);        
		this.state = {
			schedule_list:[],
            playlist:{},
            currentSchedule:{}
		}
    }
    /**
     * 準備資料如下
     * 1- schedule
     * 2- rentalContract
     */
	componentDidMount = async () => {

		try {
            /**
             * subscribe contract event
             */
            const accounts = await web3.eth.getAccounts();
            accounts[4]=address;
            console.log('accounts',accounts);
            const networkId = await web3.eth.net.getId();
            
            
            let balance =await web3.eth.getBalance(accounts[4])
            balance = web3.utils.fromWei(balance, 'ether')

            const rentalContract = new web3.eth.Contract(
				RentalContract.abi,
                RentalContract.networks[networkId].address,
                {
					from: accounts[0], // default from address
                    gasPrice: '200000000000000', // default gas price in wei, 20 gwei in this case
                    gasLimit: "900000000"
				}
            );
            rentalContract.transactionConfirmationBlocks = 2;
            rentalContract.methods.AddPlaylist(PlaylistContract.networks[networkId].address).send({from: accounts[0], gas:200000})            
            const scheduleRes = await fetch(`${mediaScheduleUrl}/`);
            const schedules = await scheduleRes.json();
            if(schedules.status==="Fail") return message.error(schedules.status_msg);
            // const schedule_list= schedules.schedule_list;
            _.forEach(schedules.schedule_list,async(schedule)=>{
                schedule.contract_status = "0";
                schedule.contract_status = await rentalContract.methods.getRentalStatus(schedule.contract_index).call();
            })
            this.setState({networkId:networkId, rentalContract:rentalContract, accounts:accounts, balance:balance, schedule_list:schedules.schedule_list});
        } catch (error) {
			// Catch any errors for any of the above operations.
			alert(`Failed to load web3, accounts, or contract. Check console for details.`);
			console.error(error);
		}
	}

    // 1 show create model
	onPlayClick = async (schedule) => {
        console.log('schedule',schedule.contract_status);
        if (schedule.contract_status ==1)return message.error("Contract Processing");
        if (schedule.contract_status ==2)return message.error("Contract Failed");
        if (schedule.contract_status ==3)return message.error("Contract Finished");
        this.setState({
            showPlayModal: true,
            currentSchedule:schedule
        });
        const {accounts,networkId,rentalContract} =this.state
        web3.eth.sendTransaction({from: accounts[5], to: accounts[3], value: '10000000000000000000'})
        .once('transactionHash', function(hash){ 
            notification.open({ message: <a rel="noopener noreferrer" target="_blank" href={`http://10.0.0.53:8000/#/tx/${hash}`}>PENDING</a>, description: `Detials From:${hash.substring(0,7)}.... to ....${hash.substr(hash.length -7)}`,duration: 0,icon: <Spin  />,});
        })
        .once('receipt', async(receipt)=>{            
            let balance =await web3.eth.getBalance(accounts[4])
            balance = web3.utils.fromWei(balance, 'ether')
            this.setState({balance:balance});

            notification.destroy();  

        })
        .on('confirmation', (confirmationNumber, receipt) => {
            console.log('confirmation receipt',confirmationNumber,receipt);
        })
        /**
         * 記錄到 log database
         */
        const url=`${transactionLogApiUrl}/`
        const logData={
            "from_account_address": accounts[5],
            "from_account_name": "contract account",
            "to_account_address": accounts[3],
            "to_account_name": "system account",
            "contract_name": "Rental",
            "contract_address": RentalContract.networks[networkId].address,
            "contract_parent_address": RentalContract.networks[networkId].address,
            "media_schedule_name":schedule.media_schedule_name,
            "action_name": "Succeeded",
            "contract_exec_result": "Succeeded",
            "transfer_coins": 10,
            "update_time": moment().tz("Asia/Taipei").format('YYYY-MM-DD HH:mm:ss'),
        };
        
        await fetch(url,{body:JSON.stringify(logData),method:"POST"});
        rentalContract.methods.updateRental(schedule.contract_index,1).send({from: accounts[2], gas:2000000})


    }
    /**
     * 2 on succeeded click 
     * sent rent_fee 85
     * */ 
    onSucceededClick = async () => {
        console.log('onSucceededClick');
        this.setState({
			showPlayModal: false,
		});
		// await web3.eth.personal.unlockAccount("0xE733e57d488Bc4cb7FA2a51e3EA38f955104DD40", "pass1234",1000)
        const {accounts, networkId, currentSchedule,rentalContract} =this.state
        console.log('schedule',currentSchedule);
        web3.eth.sendTransaction({from: accounts[5], to: accounts[4], value: '85000000000000000000'})
        .once('transactionHash', function(hash){ 
            notification.open({ message: <a rel="noopener noreferrer" target="_blank" href={`http://10.0.0.53:8000/#/tx/${hash}`}>PENDING</a>, description: `Detials From:${hash.substring(0,7)}.... to ....${hash.substr(hash.length -7)}`,duration: 0,icon: <Spin  />,});
        })
        .once('receipt', async(receipt)=>{  
            let balance =await web3.eth.getBalance(accounts[4])
            balance = web3.utils.fromWei(balance, 'ether')
            this.setState({balance:balance});
            notification.destroy();
            /**
             * 記錄到 log database
             */
            const url=`${transactionLogApiUrl}/`
            const logData={
                "from_account_address": accounts[5],
                "from_account_name": "contract account",
                "to_account_address": accounts[4],
                "to_account_name": "player account",
                "contract_name": "Rental",
                "contract_address": RentalContract.networks[networkId].address,
                "contract_parent_address": RentalContract.networks[networkId].address,
                "media_schedule_name":currentSchedule.media_schedule_name,
                "action_name": "Succeeded",
                "contract_exec_result": "Succeeded",
                "transfer_coins": 85,
                "update_time": moment().tz("Asia/Taipei").format('YYYY-MM-DD HH:mm:ss'),
            };
            
            await fetch(url,{body:JSON.stringify(logData),method:"POST"});
        })
        .on('confirmation', (confirmationNumber, receipt) => {
            console.log('confirmation receipt',confirmationNumber,receipt);
        })
        web3.eth.sendTransaction({from: accounts[5], to: accounts[3], value: '5000000000000000000'})
        .once('transactionHash', function(hash){ 
            notification.open({ message: <a rel="noopener noreferrer" target="_blank" href={`http://10.0.0.53:8000/#/tx/${hash}`}>PENDING</a>, description: `Detials From:${hash.substring(0,7)}.... to ....${hash.substr(hash.length -7)}`,duration: 0,icon: <Spin  />,});
        })
        .once('receipt', async(receipt)=>{  
            let balance =await web3.eth.getBalance(accounts[4])
            balance = web3.utils.fromWei(balance, 'ether')
            this.setState({balance:balance});

            notification.destroy();
            /**
             * 記錄到 log database
             */
            const url=`${transactionLogApiUrl}/`
            const logData={
                "from_account_address": accounts[5],
                "from_account_name": "contract account",
                "to_account_address": accounts[3],
                "to_account_name": "system account",
                "contract_name": "Rental",
                "contract_address": RentalContract.networks[networkId].address,
                "contract_parent_address": RentalContract.networks[networkId].address,
                "media_schedule_name":currentSchedule.media_schedule_name,
                "action_name": "Succeeded",
                "contract_exec_result": "Succeeded",
                "transfer_coins": 5,
                "update_time": moment().tz("Asia/Taipei").format('YYYY-MM-DD HH:mm:ss'),
            };
            
              fetch(url,{body:JSON.stringify(logData),method:"POST"});
              rentalContract.methods.updateRental(currentSchedule.contract_index,3).send({from: accounts[2], gas:2000000})

        })
        .on('confirmation', (confirmationNumber, receipt) => {
            console.log('confirmation receipt',confirmationNumber,receipt);
        })
    }
    onCancelBtnClick = () => {
		console.log('onCancelBtnClick');
		this.setState({
			showPlayModal: false,
        });
        
	}
    /**
     * 3 on Failed click 
     * refund rent_fee 85
     * */ 
	onFailedClick = async () => {
        const {accounts, networkId, currentSchedule,rentalContract} =this.state
        web3.eth.sendTransaction({from: accounts[5], to: accounts[2], value: '90000000000000000000'})
        .once('transactionHash', function(hash){ 
            notification.open({ message: <a rel="noopener noreferrer" target="_blank" href={`http://10.0.0.53:8000/#/tx/${hash}`}>PENDING</a>, description: `Detials From:${hash.substring(0,7)}.... to ....${hash.substr(hash.length -7)}`,duration: 0,icon: <Spin  />,});
        })
        .once('receipt', async(receipt)=>{  
            notification.destroy();
            /**
             * 記錄到 log database
             */
            const url=`${transactionLogApiUrl}/`
            const logData={
                "from_account_address": accounts[5],
                "from_account_name": "contract account",
                "to_account_address": accounts[2],
                "to_account_name": "buyer account",
                "contract_name": "Rental",
                "contract_address": RentalContract.networks[networkId].address,
                "contract_parent_address": RentalContract.networks[networkId].address,
                "media_schedule_name":currentSchedule.media_schedule_name,
                "action_name": "Failed",
                "contract_exec_result": "Succeeded",
                "transfer_coins": 90,
                "update_time": moment().tz("Asia/Taipei").format('YYYY-MM-DD HH:mm:ss'),
            };
            fetch(url,{body:JSON.stringify(logData),method:"POST"});
            rentalContract.methods.updateRental(currentSchedule.contract_index,2).send({from: accounts[2], gas:2000000})

        })
        this.setState({
			showPlayModal: false,
		});        
    }
    	//Delete 
	showDeleteConfirm(value) {
		Modal.confirm({
			title:"Are you sure you want to delete this schedule?",
			okText: "OK",
			cancelText: "Cancel",
			onOk: (e) => this.yes(value),
		});
	}
	yes(value) {

	return new Promise((resolve, reject) => {

			setTimeout(Math.random() > 0.3 ? resolve : reject, 10);
			var url = `${mediaScheduleUrl}/` + value;
				fetch(url, {method: 'DELETE',})
			.then(res=>res.json())
			.then(() => {
				fetch(`${mediaScheduleUrl}/`).then(res=>res.json())
				.then((results) => {
					console.log(results);
					this.setState({schedule_list:results.schedule_list})			
				})
			})
		})
    }
    
    render() {
        const columns = [
            {
                title: 'Playlist Name',
                dataIndex: 'media_schedule_name',
                key: 'media_schedule_name',
            }, 
            {
                title: 'Start Time - End Time',
                dataIndex: 'schedule_settings',
                key: 'schedule_settings',
                render:(text, record)=>{
                    return( `${text.duration_settings.start_date} ~ ${text.duration_settings.end_date}`)
                }
            }, 
            {
                title: 'Rental fee',
                dataIndex: 'rental_fee',
                key: 'rental_fee',
                render:(text, record)=>(
                    100
                )
            }, 
            {
                title: 'Created Time',
                dataIndex: 'created_time',
                key: 'created_time',
                render:(text, record)=>(
                    moment(text).format("YYYY-MM-DD")
                )
            }, 
        	{
				title: 'Action',
				dataIndex: 'action',
				render:(text, record)=>(
					<>
						<Tooltip title="Play">
							<Button shape="circle" disabled={record.contract_status!==0 ? false:true } onClick={() => this.onPlayClick(record)} icon="caret-right"  />
						</Tooltip> 
                        {/* <Tooltip title="Delete">
                            <Button shape="circle" onClick={() => this.showDeleteConfirm(record.media_schedule_id)} icon="delete"  />
						</Tooltip>  */}
					</>
				)
            },
            
        ];
    return (
        <Layout>
            <Header style={{ position: 'fixed', zIndex: 1, width: '100%', height:'34px', lineHeight:"32px" }}></Header>
            <Content style={{ padding: '0 50px', marginTop: 34 }}>
                <Breadcrumb style={{ margin: '16px 0' }}>
                    <Breadcrumb.Item></Breadcrumb.Item>
                    <Breadcrumb.Item>Device Name</Breadcrumb.Item>
                </Breadcrumb>
                <Row>
					<Col span={16}> 
					</Col>
					<Col span={8}>
						<div style={{margin:"8px"}}>
							<span style={{ padding:"12px", color:"red"}}>Coin: {this.state.balance} </span>
						</div>	
					</Col>
				</Row>
                <Row style={{ background: '#fff', padding: 24, minHeight: 380 }}>Content
                    <Table rowKey={data => data.media_schedule_id} dataSource={this.state.schedule_list} columns={columns} />

                </Row>
                {/* <Row>
                    <Button block >Play</Button>
                </Row>
                <Row>
                    <Col>
                    <Button>Fail</Button>
                    <Button>Success</Button>
                    </Col>
                </Row> */}
            </Content>
            <Modal okText="OK" cancelText="Cancel" title="Play Result" width={640} visible={this.state.showPlayModal} onOk={(evt) => this.onSucceededClick()} onCancel={this.onCancelBtnClick}>
				<Button onClick={()=>this.onSucceededClick()}> Succeeded</Button>
				<Button onClick={()=>this.onFailedClick()}> Failed</Button>

				
			</Modal>
            <Footer style={{ textAlign: 'center' }}>
                Rental System Device ©2019 
            </Footer>
        </Layout>
    );
  }
}

export default App;
