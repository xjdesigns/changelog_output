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
const config = 'config.json'
let writeOutputFile = writeOutput || false
let version = ''
let title = ''
let releaseDate = ''

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
	const versionRegex = /\d.\d.\d/g
	const versions = data.match(versionRegex)
	// RegExp for \s\S needs additional slash as being stripped
	version = versions[0]
	const allCommitsRegex = RegExp(versions[0] + '([\\s\\S]*?)\]', 'gm')
	const allCommits = data.match(allCommitsRegex)
	const commitRegex = /\*\*([\s\S]*?)\n/g
	const issues = []

	for (let i = 0; i < allCommits.length; i++) {
		const match = allCommits[i].match(commitRegex)

		if (match && match.length > 0) {
			for (let m = 0; m < match.length; m++) {
				issues.push(match[m])
			}
		}
	}

	return issues;
}

function createLinks(issues) {
	const output = []
	const WDFRegex = /([a-zA-Z]+(-[0-9]+)+)/g

	for (let i = 0; i < issues.length; i++) {
		const issue = {
			title: `N/A • ${issues[i]}`
		}
		
		if (WDFRegex.test(issues[i])) {
			const match = issues[i].match(WDFRegex)
			issue['title'] = `<${baseLink}${match[0]}|${match[0]}> • ${issues[i]}`
		}

		output.push(issue)
	}

	return output
}

function createOutputFile(data) {
	let outputFile = `${title}${releaseDate}\n${version}\n\n${data.map(d => {
		// if (d.link) {
		// 	return d.title + d.link + '\n\n'
		// }
		return d.title + '\n'
	})}`;
	outputFile = outputFile.replace(/,/g, '')
	outputFile = outputFile.replace(/\*\*/g, '')
	console.warn(outputFile)

	console.warn('slackPath', slackPath)

	if (slackPath) {
		axios({
			method: 'post',
			url: `https://hooks.slack.com/services/${slackPath}`,
			data: {
				text: 'Changelog',
				blocks: [
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: outputFile
						}
					}
				]
			},
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
