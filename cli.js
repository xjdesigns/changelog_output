#!/usr/bin/env node
'use strict'
const fs = require('fs')
const axios = require('axios')
const commandLineArgs = require('command-line-args')
const optionDefinitions = [
  { name: 'writeOutput', type: Boolean, defaultValue: false },
  { name: 'fileName', type: String },
  { name: 'link', type: String },
	{ name: 'slack', type: String }
]
const options = commandLineArgs(optionDefinitions)
const root = process.cwd()
const { writeOutput, inputFile, link, slack } = options
let baseLink = link || ''
let fileName = inputFile || 'CHANGELOG.md'
let slackPath = slack || ''
const config = 'co-config.json'
let writeOutputFile = writeOutput || false
let version = ''
let title = ''
let releaseDate = ''
const slackCharSafeLimit = 2000
let currentCharCount = 0

function checkForConfig() {
	return new Promise((res, rej) => {
		if (fs.existsSync(`${root}/${config}`)) {
			fs.readFile(`${root}/${config}`, 'utf8', (err, config) => {
				if (err) {
					console.error('err', err)
					rej(err)
				}
	
				try {
					const parsed = JSON.parse(config);
					if (parsed.writeOutput) {
						writeOutputFile = parsed.writeOutput
					}
					if (parsed.fileName) {
						fileName = parsed.fileName
					}
					if (parsed.link) {
						baseLink = parsed.link
					}
				} catch (err) {
					rej(err)
				}
		
				if (config) {
					fileData()
					res()
				}
			})
		} else {
			fileData()
			res()
		}
	})
}

async function fileData() {
	if (!baseLink) {
		console.error('Missing the baseLink value for links')
		return
	}

	fs.readFile(`${root}/${fileName}`, 'utf8', (err, data) => {
		if (err) {
			console.error('err', err)
			return
		}

		if (data) {
			createTitle(data)
			createReleaseDate(data)
			const issues = getCommitsFromVersion(data)
			const issuesWLinks = createLinks(issues)
			createOutputFile(issuesWLinks)
		} else {
			console.error('ERROR:: No data from file')
		}
	})
}

function createTitle(data) {
	const headerRegex = /#([\s\S]*?)\n/g
	const header = data.match(headerRegex)
	title = header[0]
}

function createReleaseDate(data) {
	const dateRegex = /(\(\d{4}-\d{2}-\d{2}\))/g
	const date = data.match(dateRegex)
	releaseDate= date[0]
}

function getCommitsFromVersion(data) {
	const versionRegex = /\[(\d+.\d+.\d+)\]/g
	let versions = data.match(versionRegex)
	versions = versions.filter(v => v.includes('.'))
	// RegExp for \s\S needs additional slash as being stripped
	version = versions[0]
	const version0 = versions[0].replace('[', 'v').replace(']', '')
	const version1 = versions[1].replace('[', 'v').replace(']', '')
	const allCommitsRegex = RegExp(version0 + '([\\s\\S]*?)' + version1, 'gm')
	const allCommits = data.match(allCommitsRegex)
	const commitRegex = /\*\*([\s\S]*?)\n/g
	let issueCount = 0
	const issues = []

	const match = allCommits[0].match(commitRegex)

	if (match && match.length > 0) {
		for (let m = 0; m < match.length; m++) {
			const issue = match[m]
			currentCharCount = currentCharCount + issue.length

			if (currentCharCount > slackCharSafeLimit) {
				++issueCount
				currentCharCount = 0
			}
			if (issues[issueCount]) {
				issues[issueCount].push(issue)
			} else {
				issues.push([])
				issues[issueCount].push(issue)
			}
		}
	}

	return issues;
}

function createLinks(issues) {
	const output = [...Array(issues.length)].map(() => [])
	const WDFRegex = /([a-zA-Z]+(-[0-9]+)+)/g

	for (let o = 0; o < issues.length; o++) {
		for (let i = 0; i < issues[o].length; i++) {
			// const currentIssue = issues[o][i]
			const currentIssue = changelogLinkToSlackLink(issues[o][i])
			const issue = {
				title: `N/A • ${currentIssue}`
			}

			
			if (WDFRegex.test(currentIssue)) {
				const match = currentIssue.match(WDFRegex)
				issue['title'] = `<${baseLink}${match[0]}|${match[0]}> • ${currentIssue}`
			}
	
			output[o].push(issue)
		}
	}

	return output
}

function changelogLinkToSlackLink(issue) {
	let toChange = issue
	const msgRegex = /^([^()]+)\[/g
	const hashRegex = /\[([^()]+)\]/g
	const urlRegex = /\(([^()]+)\)/g
	toChange = toChange.replace('(', '').replace(')', '')
	const msg = toChange.match(msgRegex)[0].replace('[', '')
	const hash = toChange.match(hashRegex)[0].replace('[', '').replace(']', '')
	const url = toChange.match(urlRegex)[0].replace('(', '').replace(')', '')
	console.warn('toChange', toChange)
	console.warn('msg', msg)
	console.warn('hash', hash)
	console.warn('url', url)
	return `${msg} <${url}|${hash}>`
}

function createOutputFile(data) {
	const blocks = [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `${title}${releaseDate}`
			}
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*${version}*`
			}
		}
	];
	for (let d = 0; d < data.length; d++) {
		let outputText = `${data[d].map(d => {
			return d.title + '\n'
		})}`
		outputText = outputText.replace(/,/g, '')
		outputText = outputText.replace(/\*\*/g, '')
		const block = {
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: outputText
			}
		}
		blocks.push(block)
	}

	const funEnd = {
		type: 'section',
		text: {
			type: 'mrkdwn',
			text: ':muscle::smirk:'
		}
	}
	blocks.push(funEnd)

	const slackData = {
		blocks
	};

	console.warn('Output data', blocks)

	if (slackPath) {
		axios({
			method: 'post',
			url: slackPath,
			data: slackData,
			headers: {
				'Content-type': 'application/json'
			}
		})
		.then(() => {
			console.warn('Slack post successful')
		})
		.catch(err => {
			console.error('Slack post error', err)
		})
	}

	if (writeOutputFile) {
		fs.writeFile(`${root}/outputFile.txt`, outputFile, err => {
			if (err) console.error('failed to write')
		})
	}
}

console.warn('Starting file generation')
checkForConfig()
