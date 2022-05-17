# Changelog Output

A module created to convert a standard version changelog to a more readable ouput
for a more product focused view.

This checks for changes between the new version and last version.

## Usage
```
./node_modules/.bin/cogenerate

or add as a script to run inside of npm package.json

"script": {
	...,
	"generate": "./node_modules/.bin/cogenerate"
}
```

## Options
There are 4 options you can provide to the generate either as command line args or as a co-config.json file.

> NOTE: Slack webhooks are secret URLS and should not be allowed in the config file. Pass as an arg for safety.

Link is built off the assumption that you are using jira. How this works is it looks for the ticket number inside of
description of your commit and if it exists it will append that value to the end of the link property.

### Config
In the root directory where you run this command add a `co-config.json` file.

```
{
	"writeOutput": false,
	"fileName": "CHANGELOG.md",
	"link": "https://some/path/to/"
}
```

### Command line args
Command line args are the same values as the config but allows one more option for slack webhook integration.

Slack integration already uses the following value as a base so you just need to provide the secrets portion.
`https://hooks.slack.com/services/`

```
npm run generate -- --writeOutput false --fileName CHANGELOG.md --link https://some/path/to/ --slack my/secret/ending/url
```

### Link
As stated above the link is under the assumption you are using Jira.

The regex pattern inside of commit descriptions is
```
/([a-zA-Z]+(-[0-9]+)+)/g
```

This is appended to the end of the link value you provide.

Example
```
{
	"link": "https://something.atlassian.net/browse/"
}

commit message
feat(thing): POS-43 The coolest feature ever

Output link value will be
https://something.atlassian.net/browse/POS-43
```

## NOTES
If this is the first time you are running and just ran the first release command for standard version
you will need to add one small change due to the regex pattern.

This is because the first release does not have anything to compare against and breaks the simple regex being used.

So a simple update is the following:
* Run the first release command for standard version.
* Bottom of the file will output just the starting version `"## 0.0.0"`
* Update to be something like `"## 0.0.0 [0.0.0](some_link) (2022-05-16)"`